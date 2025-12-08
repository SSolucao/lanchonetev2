import { NextResponse } from "next/server"
import { listOrders } from "@/src/services/ordersService"
import { getCurrentRestaurant } from "@/src/services/restaurantsService"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    const comandaId = searchParams.get("comanda_id")

    if (comandaId) {
      // Fetch orders for specific comanda
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("orders")
        .select("*, items:order_items(*)")
        .eq("comanda_id", comandaId)
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false })

      if (error) throw error
      return NextResponse.json(data)
    }

    const filters = {
      channel: searchParams.get("channel") as any,
      tipo_pedido: searchParams.get("tipo_pedido") as any,
      status: searchParams.get("status") as any,
      payment_status: searchParams.get("payment_status") as any,
      customer_id: searchParams.get("customer_id") || undefined,
      date_from: searchParams.get("since") || undefined,
    }

    const orders = await listOrders(restaurant.id, filters)
    return NextResponse.json(orders)
  } catch (error) {
    console.error("Error fetching orders:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
