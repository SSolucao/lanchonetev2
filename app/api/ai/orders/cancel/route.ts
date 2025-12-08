import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST /api/ai/orders/cancel - Cancelar pedido
export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log("[v0] AI Cancel Order Request:", JSON.stringify(body, null, 2))

    const { order_id, order_number, customer_phone } = body

    if (!order_id && !order_number) {
      return NextResponse.json(
        {
          error: "order_id or order_number is required",
        },
        { status: 400 },
      )
    }

    const supabase = await createClient()

    // Get restaurant
    const { data: restaurant } = await supabase.from("restaurants").select("id").limit(1).single()

    if (!restaurant) {
      return NextResponse.json({ error: "No restaurant found" }, { status: 404 })
    }

    // Find order
    let order = null

    if (order_id) {
      const { data } = await supabase.from("orders").select("*, customer:customers(*)").eq("id", order_id).single()
      order = data
    } else if (order_number) {
      // Se tiver customer_phone, filtra por cliente também
      let query = supabase
        .from("orders")
        .select("*, customer:customers(*)")
        .eq("restaurant_id", restaurant.id)
        .eq("order_number", order_number)

      if (customer_phone) {
        const cleanPhone = customer_phone.replace(/\D/g, "")
        const { data: customer } = await supabase.from("customers").select("id").eq("phone", cleanPhone).single()

        if (customer) {
          query = query.eq("customer_id", customer.id)
        }
      }

      const { data } = await query.order("created_at", { ascending: false }).limit(1).single()
      order = data
    }

    if (!order) {
      return NextResponse.json(
        {
          error: "Pedido não encontrado",
          success: false,
        },
        { status: 404 },
      )
    }

    // Check if order can be cancelled
    const nonCancellableStatuses = ["ENTREGUE", "CANCELADO", "FINALIZADO"]
    if (nonCancellableStatuses.includes(order.status)) {
      return NextResponse.json(
        {
          error: `Pedido #${order.order_number} não pode ser cancelado. Status atual: ${order.status}`,
          success: false,
        },
        { status: 400 },
      )
    }

    // Cancel order
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "CANCELADO",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)

    if (updateError) throw updateError

    console.log("[v0] Pedido cancelado:", order.id)

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        order_number: order.order_number,
        status: "CANCELADO",
        previous_status: order.status,
      },
      message: `Pedido #${order.order_number} cancelado com sucesso`,
    })
  } catch (error) {
    console.error("[v0] Error cancelling order:", error)
    return NextResponse.json(
      {
        error: "Failed to cancel order",
        details: error instanceof Error ? error.message : String(error),
        success: false,
      },
      { status: 500 },
    )
  }
}
