import { type NextRequest, NextResponse } from "next/server"
import {
  getProductById,
  updateProduct,
  deleteProduct,
  saveProductWithRecipe,
  saveComboWithItems,
} from "@/src/services/productsService"
import { getCurrentRestaurant } from "@/src/services/restaurantsService"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const product = await getProductById(id)
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }
    return NextResponse.json(product)
  } catch (error) {
    console.error("Error getting product:", error)
    return NextResponse.json({ error: "Failed to get product" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const restaurant = await getCurrentRestaurant()
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    const body = await request.json()

    const { combo_items, recipe_items, is_active, ...productData } = body

    const updates = {
      ...productData,
      ...(is_active !== undefined && { active: is_active, is_active }),
    }

    const product = await getProductById(id)
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    if (product.type === "UNIT" && recipe_items !== undefined) {
      const updatedProduct = await saveProductWithRecipe(restaurant.id, { id, updates }, recipe_items)
      return NextResponse.json(updatedProduct)
    }

    if (product.type === "COMBO") {
      const updatedProduct = await saveComboWithItems(restaurant.id, { id, updates }, combo_items || [])
      return NextResponse.json(updatedProduct)
    }

    const updatedProduct = await updateProduct(id, updates)
    return NextResponse.json(updatedProduct)
  } catch (error: any) {
    console.error("Error updating product:", error)
    return NextResponse.json(
      {
        error: "Failed to update product",
        details: error.message,
        code: error.code,
        hint: error.hint,
        statusCode: error.statusCode,
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    const product = await getProductById(id)
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    // Verify product belongs to current restaurant
    if (product.restaurant_id !== restaurant.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    await deleteProduct(id)
    return NextResponse.json({ success: true, message: "Product deactivated successfully" })
  } catch (error) {
    console.error("Error deleting product:", error)
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 })
  }
}
