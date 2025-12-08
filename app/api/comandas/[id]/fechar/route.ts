import { type NextRequest, NextResponse } from "next/server"
import { fecharComanda, type FecharComandaInput } from "@/src/services/comandasService"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    console.log("[v0] Closing comanda:", id, "with payment method:", body.payment_method_id)

    const input: FecharComandaInput = {
      payment_method_id: body.payment_method_id,
    }

    const comanda = await fecharComanda(id, input)

    console.log("[v0] Comanda closed successfully:", comanda)

    return NextResponse.json(comanda)
  } catch (error: any) {
    console.error("[v0] Error closing comanda:", error)
    return NextResponse.json({ error: error.message || "Failed to close comanda" }, { status: 500 })
  }
}
