import { type NextRequest, NextResponse } from "next/server"
import { updatePaymentMethod } from "@/src/services/paymentMethodsService"

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const paymentMethod = await updatePaymentMethod(params.id, body)
    return NextResponse.json(paymentMethod)
  } catch (error) {
    console.error("Error updating payment method:", error)
    return NextResponse.json({ error: "Failed to update payment method" }, { status: 500 })
  }
}
