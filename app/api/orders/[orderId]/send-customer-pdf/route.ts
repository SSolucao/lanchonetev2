import { NextResponse } from "next/server"
import { getOrderForPrint } from "@/src/services/ordersService"
import { sendOrderPdfToWhatsApp } from "@/src/services/whatsappService"

const normalizePhone = (value: string) => value.replace(/\D/g, "")

export async function POST(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params
    const order = await getOrderForPrint(orderId)
    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    const rawPhone = order.customer?.phone || ""
    const number = normalizePhone(rawPhone)
    if (!number) {
      return NextResponse.json({ skipped: true, reason: "missing_phone" })
    }

    await sendOrderPdfToWhatsApp({ orderId, number })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error sending order PDF:", error)
    return NextResponse.json({ error: "Falha ao enviar PDF" }, { status: 500 })
  }
}
