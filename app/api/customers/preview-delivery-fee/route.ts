import { type NextRequest, NextResponse } from "next/server"
import { getCurrentRestaurant } from "@/src/services/restaurantsService"
import { buildFullAddress, calculateDeliveryFee } from "@/src/services/deliveryFeeService"

export async function POST(request: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant?.address) {
      return NextResponse.json({ success: false, error: "Restaurant not found" }, { status: 404 })
    }

    const body = await request.json()
    const { street, number, neighborhood, city } = body || {}

    if (!street || !number || !neighborhood || !city) {
      return NextResponse.json({ success: false, error: "Endereço incompleto" }, { status: 400 })
    }

    const customerAddress = buildFullAddress(street, number, neighborhood, city)
    const result = await calculateDeliveryFee(
      restaurant.id,
      restaurant.address,
      customerAddress,
      neighborhood || null,
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error("[v0] Error previewing delivery fee:", error)
    return NextResponse.json({ success: false, fee: 0, distance_km: 0 }, { status: 500 })
  }
}
