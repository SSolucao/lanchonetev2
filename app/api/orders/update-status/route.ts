import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { updateOrderStatus } from "@/src/services/ordersService"
import { onOrderStatusChanged } from "@/src/services/n8nClient"
import { notifyOrderCancelled } from "@/src/services/orderStatusEvents"
import { sendWhatsAppMenu, sendWhatsAppText } from "@/src/services/whatsappService"
import type { OrderStatus } from "@/src/domain/types"

type OrderStatusPayload = {
  orderId?: string
  order_number?: number
  newStatus: OrderStatus
  restaurantId?: string
}

export async function POST(request: NextRequest) {
  try {
    const { orderId: rawOrderId, order_number, newStatus, restaurantId: rawRestaurantId } =
      (await request.json()) as OrderStatusPayload

    console.log("[v0] Updating order status:", { orderId: rawOrderId, order_number, newStatus, restaurantId: rawRestaurantId })

    if ((!rawOrderId && order_number === undefined) || !newStatus) {
      return NextResponse.json(
        { error: "orderId OR order_number and newStatus are required" },
        { status: 400 },
      )
    }

    const supabase = await createClient()

    let orderId = rawOrderId ?? null
    let restaurantId = rawRestaurantId ?? null
    let oldStatus: OrderStatus | null = null

    // Resolve pelo número se vier apenas order_number
    if (!orderId && order_number !== undefined) {
      let query = supabase
        .from("orders")
        .select("id, status, restaurant_id")
        .eq("order_number", order_number)
        .limit(1)
        .single()

      if (restaurantId) {
        query = query.eq("restaurant_id", restaurantId)
      }

      const { data: orderByNumber, error } = await query
      if (error || !orderByNumber) {
        console.error("[v0] Order not found by number:", { order_number, restaurantId, error })
        return NextResponse.json({ error: `Order not found for number ${order_number}` }, { status: 404 })
      }

      orderId = orderByNumber.id
      oldStatus = orderByNumber.status as OrderStatus
      if (!restaurantId) restaurantId = orderByNumber.restaurant_id
    }

    // Caso não tenha oldStatus ainda (veio via orderId)
    if (!oldStatus) {
      const { data: oldOrderData, error: fetchError } = await supabase
        .from("orders")
        .select("status, restaurant_id")
        .eq("id", orderId)
        .single()

      if (fetchError || !oldOrderData) {
        console.error("[v0] Error fetching old order:", fetchError)
        return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 })
      }

      oldStatus = oldOrderData.status as OrderStatus
      if (!restaurantId) restaurantId = oldOrderData.restaurant_id
    }

    // Now update the order status
    const updatedOrder = await updateOrderStatus(orderId!, newStatus as OrderStatus)

    console.log("[v0] Order status updated successfully:", {
      orderId,
      oldStatus,
      newStatus: updatedOrder.status,
    })

    if (restaurantId && oldStatus !== newStatus) {
      console.log("[v0] Notifying n8n about status change")
      onOrderStatusChanged({
        restaurantId,
        orderId: orderId!,
        oldStatus,
        newStatus,
        timestamp: new Date().toISOString(),
      }).catch((err) => console.error("[v0] Failed to notify n8n:", err))
    }

    if (restaurantId && newStatus === "CANCELADO" && oldStatus !== "CANCELADO") {
      notifyOrderCancelled({
        orderId: orderId!,
        restaurantId,
        oldStatus,
      }).catch((err) => console.error("[v0] Failed to notify cancel:", err))
    }

    // Notificações WhatsApp
    if (newStatus === "EM_PREPARO" || newStatus === "SAIU_PARA_ENTREGA" || newStatus === "FINALIZADO") {
      try {
        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select(
            `
            id,
            order_number,
            tipo_pedido,
            channel,
            delivery_mode,
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

          if (newStatus === "FINALIZADO" && oldStatus !== "FINALIZADO") {
            const isRetirada = orderData.tipo_pedido === "RETIRADA" || orderData.delivery_mode === "RETIRA"

            if (isRetirada) {
              const text = `Olá${customerName ? `, ${customerName}` : ""}! Seu pedido #${
                orderData.order_number
              } está pronto para retirada. Obrigado! – ${restaurantName}`

              sendWhatsAppText({ number: orderData.customer.phone, text }).catch((err) =>
                console.error("[v0] Error sending WhatsApp message:", err),
              )
            }
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
