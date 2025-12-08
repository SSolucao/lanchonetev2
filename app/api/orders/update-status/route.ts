import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { updateOrderStatus } from "@/src/services/ordersService"
import { onOrderStatusChanged } from "@/src/services/n8nClient"
import type { OrderStatus } from "@/src/domain/types"

export async function POST(request: NextRequest) {
  try {
    const { orderId, newStatus, restaurantId } = await request.json()

    console.log("[v0] Updating order status:", { orderId, newStatus, restaurantId })

    if (!orderId || !newStatus) {
      return NextResponse.json({ error: "Order ID and new status are required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: oldOrderData, error: fetchError } = await supabase
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single()

    if (fetchError) {
      console.error("[v0] Error fetching old order:", fetchError)
      return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 })
    }

    const oldStatus = oldOrderData.status

    // Now update the order status
    const updatedOrder = await updateOrderStatus(orderId, newStatus as OrderStatus)

    console.log("[v0] Order status updated successfully:", {
      orderId,
      oldStatus,
      newStatus: updatedOrder.status,
    })

    if (restaurantId && oldStatus !== newStatus) {
      console.log("[v0] Notifying n8n about status change")
      onOrderStatusChanged({
        restaurantId,
        orderId,
        oldStatus,
        newStatus,
        timestamp: new Date().toISOString(),
      }).catch((err) => console.error("[v0] Failed to notify n8n:", err))
    }

    return NextResponse.json({ success: true, order: updatedOrder })
  } catch (error) {
    console.error("[v0] Error updating order status:", error)
    return NextResponse.json({ error: "Failed to update order status" }, { status: 500 })
  }
}
