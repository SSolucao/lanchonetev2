import { NextResponse } from "next/server"
import { notifyStockUpdate } from "@/src/services/n8nClient"
import { getOrderById, getOrderItems } from "@/src/services/ordersService"

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get("orderId")

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 })
    }

    const order = await getOrderById(orderId)
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const items = await getOrderItems(orderId)

    // Notify n8n about stock update
    await notifyStockUpdate({
      order_id: order.id,
      items: items.map((item) => ({
        product_id: item.product_id,
        product_name: "", // We don't have product name here
        quantity: item.quantity,
      })),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error notifying stock update:", error)
    // Don't fail the order creation if n8n notification fails
    return NextResponse.json({ success: false, error: "Failed to notify stock update" }, { status: 200 })
  }
}
