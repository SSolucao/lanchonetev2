import { type NextRequest, NextResponse } from "next/server"
import { listPaymentMethods, createPaymentMethod } from "@/src/services/paymentMethodsService"
import { getCurrentRestaurant } from "@/src/services/restaurantsService"

export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    const paymentMethods = await listPaymentMethods(restaurant.id)
    return NextResponse.json(paymentMethods)
  } catch (error) {
    console.error("Error listing payment methods:", error)
    return NextResponse.json({ error: "Failed to list payment methods" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    const body = await request.json()
    const paymentMethod = await createPaymentMethod({
      ...body,
      restaurant_id: restaurant.id,
    })

    return NextResponse.json(paymentMethod)
  } catch (error) {
    console.error("Error creating payment method:", error)
    return NextResponse.json({ error: "Failed to create payment method" }, { status: 500 })
  }
}
