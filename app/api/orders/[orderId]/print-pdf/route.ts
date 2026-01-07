import { NextResponse } from "next/server"
import { buildOrderPdfBuffer } from "@/src/lib/print/orderPdf"

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params
    const buffer = await buildOrderPdfBuffer(orderId)
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="pedido-${orderId}.pdf"`,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }
    console.error("[v0] Error generating print PDF:", error)
    return NextResponse.json({ error: "Falha ao gerar PDF" }, { status: 500 })
  }
}
