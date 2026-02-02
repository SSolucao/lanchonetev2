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

    // Get active addons
    const { data: addons } = await supabase
      .from("addons")
      .select("id, name, price, category, is_active")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)

    const addonIds = (addons || []).map((a) => a.id)

    // Get addon categories (multi-category support)
    let addonCategories: { addon_id: string; category: string }[] = []
    if (addonIds.length > 0) {
      const { data } = await supabase
        .from("addon_categories")
        .select("addon_id, category")
        .in("addon_id", addonIds)
      addonCategories = (data || []) as any[]
    }

    // Get product-addon explicit bindings
    let productAddons: { product_id: string; addon_id: string }[] = []
    if (addonIds.length > 0) {
      const { data } = await supabase
        .from("product_addons")
        .select("product_id, addon_id")
        .eq("restaurant_id", restaurant.id)
      productAddons = (data || []) as any[]
    }

    const addonCategoriesMap = addonCategories.reduce<Record<string, string[]>>((acc, row) => {
      if (!row?.addon_id || !row?.category) return acc
      acc[row.addon_id] = acc[row.addon_id] || []
      if (!acc[row.addon_id].includes(row.category)) {
        acc[row.addon_id].push(row.category)
      }
      return acc
    }, {})

    const addonProductMap = productAddons.reduce<Record<string, string[]>>((acc, row) => {
      if (!row?.addon_id || !row?.product_id) return acc
      acc[row.addon_id] = acc[row.addon_id] || []
      if (!acc[row.addon_id].includes(row.product_id)) {
        acc[row.addon_id].push(row.product_id)
      }
      return acc
    }, {})

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
          url_image: p.url_image || null,
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
          url_image: c.url_image || null,
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
      addons: (addons || []).map((ad) => {
        const categories = addonCategoriesMap[ad.id] && addonCategoriesMap[ad.id].length > 0
          ? addonCategoriesMap[ad.id]
          : ad.category
            ? [ad.category]
            : []
        const product_ids = addonProductMap[ad.id] || []
        return {
          id: ad.id,
          name: ad.name,
          price: ad.price,
          categories,
          product_ids,
        }
      }),
    }

    return NextResponse.json(menu)
  } catch (error) {
    console.error("[v0] Error fetching menu:", error)
    return NextResponse.json({ error: "Failed to fetch menu" }, { status: 500 })
  }
}
