import { type NextRequest, NextResponse } from "next/server"
import { getCurrentRestaurant, updateRestaurant } from "@/src/services/restaurantsService"

export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }
    return NextResponse.json(restaurant)
  } catch (error) {
    console.error("Error getting restaurant:", error)
    return NextResponse.json({ error: "Failed to get restaurant" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    const body = await request.json()
    const updatedRestaurant = await updateRestaurant(restaurant.id, body)
    return NextResponse.json(updatedRestaurant)
  } catch (error) {
    console.error("Error updating restaurant:", error)
    return NextResponse.json({ error: "Failed to update restaurant" }, { status: 500 })
  }
}
