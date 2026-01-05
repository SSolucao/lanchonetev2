import { NextResponse, type NextRequest } from "next/server"
import { getCurrentRestaurant } from "@/src/services/restaurantsService"
import { listAddons, createAddon } from "@/src/services/addonsService"

export async function GET(request: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const includeInactive = ["1", "true", "yes"].includes((searchParams.get("include_inactive") || "").toLowerCase())

    const addons = await listAddons(restaurant.id, includeInactive)
    return NextResponse.json(addons)
  } catch (error) {
    console.error("Error listing addons:", error)
    return NextResponse.json({ error: "Failed to list addons" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    const body = await request.json()
    const { name, category, categories: rawCategories, price, is_active } = body

    const categories = Array.isArray(rawCategories)
      ? Array.from(new Set(rawCategories.map((c: any) => (c ? String(c).trim() : "")).filter(Boolean)))
      : undefined

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const hasLegacyCategory = category && String(category).trim().length > 0
    const hasCategoriesArray = categories && categories.length > 0
    if (!hasLegacyCategory && !hasCategoriesArray) {
      return NextResponse.json({ error: "At least one category is required" }, { status: 400 })
    }

    const addon = await createAddon(restaurant.id, {
      name,
      category: hasLegacyCategory ? String(category).trim() : undefined,
      categories,
      price: Number(price) || 0,
      is_active: is_active ?? true,
    })

    return NextResponse.json(addon)
  } catch (error) {
    console.error("Error creating addon:", error)
    return NextResponse.json({ error: "Failed to create addon" }, { status: 500 })
  }
}
