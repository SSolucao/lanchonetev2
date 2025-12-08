import { type NextRequest, NextResponse } from "next/server"
import { calculateDeliveryFee } from "@/src/services/n8nClient"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cep_origem, cep_destino } = body

    if (!cep_origem || !cep_destino) {
      return NextResponse.json({ success: false, error: "CEP origem e destino são obrigatórios" }, { status: 400 })
    }

    console.log("[v0] Calling n8n to calculate delivery fee:", { cep_origem, cep_destino })

    const result = await calculateDeliveryFee({
      cep_origem,
      cep_destino,
    })

    console.log("[v0] n8n delivery fee result:", result)

    if (!result.success || result.error) {
      return NextResponse.json({
        success: false,
        fee: result.fee || 0,
        distance_km: result.distance_km || 0,
        message:
          result.message ||
          result.error ||
          "Não foi possível calcular a taxa automaticamente. Por favor, insira manualmente.",
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[v0] Error in delivery fee calculation:", error)
    return NextResponse.json({
      success: false,
      fee: 0,
      distance_km: 0,
      message: "Não foi possível calcular a taxa automaticamente. Por favor, insira manualmente.",
    })
  }
}
