import { createClient } from "@/lib/supabase/server"
import { onOrderStatusChanged } from "@/src/services/n8nClient"
import { sendWhatsAppText } from "@/src/services/whatsappService"
import type { OrderStatus } from "@/src/domain/types"

type EmPreparoNotificationParams = {
  orderId: string
  restaurantId: string
  oldStatus?: OrderStatus
}

type CancelamentoNotificationParams = {
  orderId: string
  restaurantId: string
  oldStatus?: OrderStatus
}

function normalizeWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, "")
  if (!digits) return null
  if (digits.startsWith("55")) return digits
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }
  return digits
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
        tipo_pedido,
        delivery_mode,
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

    const phone = normalizeWhatsAppNumber(orderData?.customer?.phone)
    if (phone) {
      const customerName = orderData.customer.name || ""
      const firstName = customerName.trim().split(/\s+/)[0] || ""
      const restaurantName = orderData.restaurant?.name || "nosso time"
      const isRetirada = orderData.tipo_pedido === "RETIRADA" || orderData.delivery_mode === "RETIRA"
      const text = isRetirada
        ? `Olá${firstName ? `, ${firstName}` : ""}! Seu pedido ${
            orderData.order_number
          } está em preparo. Avisaremos assim que estiver pronto para retirada. Obrigado! – ${restaurantName}`
        : `Olá${customerName ? `, ${customerName}` : ""}! Seu pedido #${
            orderData.order_number
          } está em preparo. Avisaremos assim que sair para entrega. Obrigado! – ${restaurantName}`

      sendWhatsAppText({ number: phone, text }).catch((err) =>
        console.error("[v0] Error sending WhatsApp message:", err),
      )
    }
  } catch (err) {
    console.error("[v0] Error preparing WhatsApp notification:", err)
  }
}

export async function notifyOrderCancelled({
  orderId,
  restaurantId,
  oldStatus = "NOVO",
}: CancelamentoNotificationParams): Promise<void> {
  if (oldStatus === "CANCELADO") return

  onOrderStatusChanged({
    restaurantId,
    orderId,
    oldStatus,
    newStatus: "CANCELADO",
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

    const phone = normalizeWhatsAppNumber(orderData?.customer?.phone)
    if (phone) {
      const customerName = orderData.customer.name || ""
      const text = `Olá${customerName ? `, ${customerName}` : ""}. Seu pedido #${
        orderData.order_number
      } foi cancelado. Se precisar de ajuda, fale com a gente.`

      sendWhatsAppText({ number: phone, text }).catch((err) =>
        console.error("[v0] Error sending WhatsApp message:", err),
      )
    }
  } catch (err) {
    console.error("[v0] Error preparing WhatsApp notification:", err)
  }
}
