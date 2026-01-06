import { createClient } from "@/lib/supabase/server"
import { onOrderStatusChanged } from "@/src/services/n8nClient"
import { sendWhatsAppText } from "@/src/services/whatsappService"
import type { OrderStatus } from "@/src/domain/types"

type EmPreparoNotificationParams = {
  orderId: string
  restaurantId: string
  oldStatus?: OrderStatus
}

export async function notifyOrderEnteredEmPreparo({
  orderId,
  restaurantId,
  oldStatus = "NOVO",
}: EmPreparoNotificationParams): Promise<void> {
  if (oldStatus === "EM_PREPARO") return

  onOrderStatusChanged({
    restaurantId,
    orderId,
    oldStatus,
    newStatus: "EM_PREPARO",
    timestamp: new Date().toISOString(),
  }).catch((err) => console.error("[v0] Failed to notify n8n:", err))

  try {
    const supabase = await createClient()
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
      return
    }

    if (orderData?.customer?.phone) {
      const customerName = orderData.customer.name || ""
      const restaurantName = orderData.restaurant?.name || "nosso time"
      const text = `Olá${customerName ? `, ${customerName}` : ""}! Seu pedido #${
        orderData.order_number
      } está em preparo. Avisaremos assim que sair para entrega. Obrigado! – ${restaurantName}`

      sendWhatsAppText({ number: orderData.customer.phone, text }).catch((err) =>
        console.error("[v0] Error sending WhatsApp message:", err),
      )
    }
  } catch (err) {
    console.error("[v0] Error preparing WhatsApp notification:", err)
  }
}
