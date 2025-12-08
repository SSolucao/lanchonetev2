import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    // Get restaurant
    const { data: restaurant } = await supabase.from("restaurants").select("id").limit(1).single()

    if (!restaurant) {
      return NextResponse.json({ error: "No restaurant found" }, { status: 404 })
    }

    // Get all active products
    const { data: products } = await supabase
      .from("products")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .eq("type", "UNIT")
      .order("category")
      .order("name")

    // Get recipes separately
    const { data: recipes } = await supabase
      .from("product_stock_recipe")
      .select("product_id, quantity, stock_item_id")
      .eq("restaurant_id", restaurant.id)

    // Get stock items
    const { data: stockItems } = await supabase
      .from("stock_items")
      .select("id, name, unit")
      .eq("restaurant_id", restaurant.id)

    // Get all active combos
    const { data: combos } = await supabase
      .from("products")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .eq("type", "COMBO")
      .order("name")

    // Get combo items separately
    const { data: comboItems } = await supabase
      .from("product_combo_items")
      .select("combo_id, product_id, quantity")
      .eq("restaurant_id", restaurant.id)

    // Format menu for AI
    const menu = {
      restaurant: {
        id: restaurant.id,
      },
      products: (products || []).map((p) => {
        const productRecipes = (recipes || []).filter((r) => r.product_id === p.id)
        return {
          id: p.id,
          name: p.name,
          category: p.category,
          price: p.price,
          description: p.description || "",
          ingredients: productRecipes.map((r) => {
            const item = (stockItems || []).find((s) => s.id === r.stock_item_id)
            return {
              name: item?.name || "Unknown",
              quantity: r.quantity,
              unit: item?.unit || "UN",
            }
          }),
        }
      }),
      combos: (combos || []).map((c) => {
        const comboProducts = (comboItems || []).filter((ci) => ci.combo_id === c.id)
        return {
          id: c.id,
          name: c.name,
          category: c.category,
          price: c.price,
          description: c.description || "",
          items: comboProducts.map((ci) => {
            const product = (products || []).find((p) => p.id === ci.product_id)
            return {
              name: product?.name || "Unknown",
              quantity: ci.quantity,
              price: product?.price || 0,
            }
          }),
        }
      }),
    }

    return NextResponse.json(menu)
  } catch (error) {
    console.error("[v0] Error fetching menu:", error)
    return NextResponse.json({ error: "Failed to fetch menu" }, { status: 500 })
  }
}
