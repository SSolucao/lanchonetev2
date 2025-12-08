import { NextResponse } from "next/server"
import { getOrderForPrint } from "@/src/services/ordersService"

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params
    const order = await getOrderForPrint(orderId)

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    return NextResponse.json({ order })
  } catch (error) {
    console.error("[v0] Error fetching order for print:", error)
    return NextResponse.json({ error: "Erro ao buscar pedido" }, { status: 500 })
  }
}
