import { type NextRequest, NextResponse } from "next/server"
import { listProducts, createProduct, saveProductWithRecipe, saveComboWithItems } from "@/src/services/productsService"
import { getCurrentRestaurant } from "@/src/services/restaurantsService"

export async function GET(request: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")
    const includeInactive = ["1", "true", "yes"].includes((searchParams.get("include_inactive") || "").toLowerCase())

    const filters =
      type || includeInactive
        ? {
            ...(type ? { type: type as "UNIT" | "COMBO" } : {}),
            ...(includeInactive ? { include_inactive: true } : { is_active: true }),
          }
        : undefined
    const products = await listProducts(restaurant.id, filters)

    return NextResponse.json(products)
  } catch (error) {
    console.error("Error listing products:", error)
    return NextResponse.json({ error: "Failed to list products" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    const body = await request.json()
    const { combo_items, recipe_items, is_active, ...productData } = body

    const dataWithActiveField = {
      ...productData,
      ...(is_active !== undefined && { is_active }),
      restaurant_id: restaurant.id,
    }

    if (productData.type === "UNIT" && recipe_items && recipe_items.length > 0) {
      const product = await saveProductWithRecipe(restaurant.id, dataWithActiveField, recipe_items)
      return NextResponse.json(product)
    }

    // Handle COMBO products
    if (productData.type === "COMBO") {
      const product = await saveComboWithItems(restaurant.id, dataWithActiveField, combo_items || [])
      return NextResponse.json(product)
    }

    // Handle simple products without recipe
    const product = await createProduct(dataWithActiveField)

    return NextResponse.json(product)
  } catch (error) {
    console.error("Error creating product:", error)
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 })
  }
}
