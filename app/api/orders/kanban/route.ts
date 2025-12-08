import { type NextRequest, NextResponse } from "next/server"
import { listOrdersForKanban } from "@/src/services/ordersService"
import { getCurrentRestaurant } from "@/src/services/restaurantsService"

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] Kanban API called")

    const restaurant = await getCurrentRestaurant()
    console.log("[v0] Current restaurant:", restaurant?.id, restaurant?.name)

    if (!restaurant) {
      console.log("[v0] No restaurant found - unauthorized")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const tipo_pedido = searchParams.get("tipo_pedido") as "BALCAO" | "RETIRADA" | "ENTREGA" | "COMANDA" | null
    const period = searchParams.get("period") as "30min" | "today" | "all" | null

    console.log("[v0] Kanban filters:", { tipo_pedido, period })

    const orders = await listOrdersForKanban(restaurant.id, {
      tipo_pedido: tipo_pedido || undefined,
      period: period || "today",
    })

    console.log("[v0] Kanban API returning", orders.length, "orders")
    if (orders.length > 0) {
      console.log("[v0] Sample order:", {
        id: orders[0].id,
        tipo_pedido: orders[0].tipo_pedido,
        status: orders[0].status,
        created_at: orders[0].created_at,
      })
    }

    return NextResponse.json({ orders })
  } catch (error) {
    console.error("[v0] Error fetching kanban orders:", error)
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
  }
}
