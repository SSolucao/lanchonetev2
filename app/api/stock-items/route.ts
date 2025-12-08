import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listStockItems, createStockItem } from "@/src/services/stockService"

export async function GET() {
  try {
    console.log("[v0] Fetching stock items...")

    const supabase = await createClient()
    const { data: restaurants } = await supabase.from("restaurants").select("id").limit(1)

    if (!restaurants || restaurants.length === 0) {
      return NextResponse.json({ error: "No restaurant found" }, { status: 404 })
    }

    const restaurantId = restaurants[0].id
    const stockItems = await listStockItems(restaurantId)

    console.log(`[v0] Found ${stockItems.length} stock items`)
    return NextResponse.json(stockItems)
  } catch (error) {
    console.error("Error fetching stock items:", error)
    return NextResponse.json({ error: "Failed to fetch stock items" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log("[v0] Creating stock item:", body)

    const supabase = await createClient()
    const { data: restaurants } = await supabase.from("restaurants").select("id").limit(1)

    if (!restaurants || restaurants.length === 0) {
      return NextResponse.json({ error: "No restaurant found" }, { status: 404 })
    }

    const restaurantId = restaurants[0].id

    const stockItem = await createStockItem({
      restaurant_id: restaurantId,
      name: body.name,
      unit: body.unit,
      current_qty: body.current_qty,
      min_qty: body.min_qty,
      notes: body.notes,
      is_active: body.is_active ?? true,
    })

    console.log("[v0] Stock item created successfully:", stockItem.id)
    return NextResponse.json(stockItem)
  } catch (error) {
    console.error("Error creating stock item:", error)
    return NextResponse.json({ error: "Failed to create stock item" }, { status: 500 })
  }
}
