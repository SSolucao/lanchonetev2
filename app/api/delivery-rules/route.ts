import { type NextRequest, NextResponse } from "next/server"
import { listDeliveryRules, createDeliveryRule } from "@/src/services/deliveryRulesService"
import { getCurrentRestaurant } from "@/src/services/restaurantsService"

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

    return NextResponse.json(deliveryRule)
  } catch (error) {
    console.error("Error creating delivery rule:", error)
    return NextResponse.json({ error: "Failed to create delivery rule" }, { status: 500 })
  }
}
