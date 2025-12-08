import { NextResponse } from "next/server"
import { markOrderKitchenPrinted, markOrderCustomerPrinted } from "@/src/services/ordersService"

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params
    const body = await request.json()
    const { type } = body

    if (type === "kitchen") {
      await markOrderKitchenPrinted(orderId)
    } else if (type === "customer") {
      await markOrderCustomerPrinted(orderId)
    } else {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error marking order as printed:", error)
    return NextResponse.json({ error: "Erro ao marcar como impresso" }, { status: 500 })
  }
}
