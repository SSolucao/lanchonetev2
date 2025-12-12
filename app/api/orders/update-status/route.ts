import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { updateOrderStatus } from "@/src/services/ordersService"
import { onOrderStatusChanged } from "@/src/services/n8nClient"
import { sendWhatsAppMenu, sendWhatsAppText } from "@/src/services/whatsappService"
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

    // Notificações WhatsApp
    if (newStatus === "EM_PREPARO" || newStatus === "SAIU_PARA_ENTREGA") {
      try {
        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select(
            `
            id,
            order_number,
            restaurant:restaurants(name),
            customer:customers(name, phone)
          `,
          )
          .eq("id", orderId)
          .single()

        if (orderError) {
          console.error("[v0] Error fetching order for WhatsApp notification:", orderError)
        } else if (orderData?.customer?.phone) {
          const customerName = orderData.customer.name || ""
          const restaurantName = orderData.restaurant?.name || "nosso time"

          if (newStatus === "EM_PREPARO" && oldStatus !== "EM_PREPARO") {
            const text = `Olá${customerName ? `, ${customerName}` : ""}! Seu pedido #${
              orderData.order_number
            } está em preparo. Avisaremos assim que sair para entrega. Obrigado! – ${restaurantName}`

            sendWhatsAppText({ number: orderData.customer.phone, text }).catch((err) =>
              console.error("[v0] Error sending WhatsApp message:", err),
            )
          }

          if (newStatus === "SAIU_PARA_ENTREGA" && oldStatus !== "SAIU_PARA_ENTREGA") {
            const text =
              "Seu pedido acabou de sair, por favor, assim que receber seu pedido por favor avalie ou se tiver qualque problam, selecione abaixo"
            const num = orderData.order_number
            const choices = [
              `Recebi meu pedido #${num}|pedido`,
              `Tive um problema com meu pedido #${num}|pedido`,
            ]

            sendWhatsAppMenu({
              number: orderData.customer.phone,
              text,
              choices,
            }).catch((err) => console.error("[v0] Error sending WhatsApp menu:", err))
          }
        }
      } catch (err) {
        console.error("[v0] Error preparing WhatsApp notification:", err)
      }
    }

    return NextResponse.json({ success: true, order: updatedOrder })
  } catch (error) {
    console.error("[v0] Error updating order status:", error)
    return NextResponse.json({ error: "Failed to update order status" }, { status: 500 })
  }
}
