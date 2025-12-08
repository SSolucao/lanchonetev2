import { type NextRequest, NextResponse } from "next/server"
import { updateDeliveryRule, deleteDeliveryRule } from "@/src/services/deliveryRulesService"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const deliveryRule = await updateDeliveryRule(id, body)
    return NextResponse.json(deliveryRule)
  } catch (error) {
    console.error("Error updating delivery rule:", error)
    return NextResponse.json({ error: "Failed to update delivery rule" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    console.log("[v0] Deleting delivery rule:", id)
    await deleteDeliveryRule(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting delivery rule:", error)
    return NextResponse.json({ error: "Failed to delete delivery rule" }, { status: 500 })
  }
}
