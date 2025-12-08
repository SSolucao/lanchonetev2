import { NextResponse } from "next/server"
import { getProductRecipe, saveProductRecipe } from "@/src/services/stockService"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const recipe = await getProductRecipe(id)

    return NextResponse.json(recipe)
  } catch (error) {
    console.error("Error fetching product recipe:", error)
    return NextResponse.json({ error: "Failed to fetch product recipe" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    // Get restaurant from first restaurant (simplified for now)
    const { data: restaurants } = await (await import("@/lib/supabase/server"))
      .createClient()
      .from("restaurants")
      .select("id")
      .limit(1)

    if (!restaurants || restaurants.length === 0) {
      return NextResponse.json({ error: "No restaurant found" }, { status: 404 })
    }

    const restaurantId = restaurants[0].id

    await saveProductRecipe(restaurantId, id, body.recipeItems)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving product recipe:", error)
    return NextResponse.json({ error: "Failed to save product recipe" }, { status: 500 })
  }
}
