import { type NextRequest, NextResponse } from "next/server"
import { listDeliveryRules, createDeliveryRule } from "@/src/services/deliveryRulesService"
import { getCurrentRestaurant } from "@/src/services/restaurantsService"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    const deliveryRules = await listDeliveryRules(restaurant.id)
    return NextResponse.json(deliveryRules)
  } catch (error) {
    console.error("Error listing delivery rules:", error)
    return NextResponse.json({ error: "Failed to list delivery rules" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    const body = await request.json()
    const deliveryRule = await createDeliveryRule({
      ...body,
      restaurant_id: restaurant.id,
    })

    if (deliveryRule.neighborhood) {
      const supabase = await createClient()
      const normalized = deliveryRule.neighborhood.trim()
      if (normalized) {
        const pattern = `%${normalized}%`
        await supabase
          .from("customers")
          .update({ delivery_fee_default: deliveryRule.fee, delivery_available: true })
          .eq("restaurant_id", restaurant.id)
          .ilike("neighborhood", pattern)
          .or("delivery_fee_default.is.null,delivery_fee_default.eq.0")
      }
    }

    return NextResponse.json(deliveryRule)
  } catch (error) {
    console.error("Error creating delivery rule:", error)
    return NextResponse.json({ error: "Failed to create delivery rule" }, { status: 500 })
  }
}
