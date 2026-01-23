import { type NextRequest, NextResponse } from "next/server"
import { updateDeliveryRule, deleteDeliveryRule } from "@/src/services/deliveryRulesService"
import { createClient } from "@/lib/supabase/server"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const deliveryRule = await updateDeliveryRule(id, body)

    if (deliveryRule.neighborhood) {
      const supabase = await createClient()
      const normalized = deliveryRule.neighborhood.trim()
      if (normalized) {
        const pattern = `%${normalized}%`
        await supabase
          .from("customers")
          .update({ delivery_fee_default: deliveryRule.fee, delivery_available: true })
          .eq("restaurant_id", deliveryRule.restaurant_id)
          .ilike("neighborhood", pattern)
          .or("delivery_fee_default.is.null,delivery_fee_default.eq.0")
      }
    }

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
