import { type NextRequest, NextResponse } from "next/server"
import { getCurrentRestaurant, updateRestaurant, upsertBusinessHours } from "@/src/services/restaurantsService"

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
    const { business_hours: businessHours, ...updates } = body ?? {}

    if (businessHours) {
      await upsertBusinessHours(restaurant.id, businessHours)
    }

    const updatedRestaurant =
      updates && Object.keys(updates).length > 0 ? await updateRestaurant(restaurant.id, updates) : restaurant

    const refreshedRestaurant = await getCurrentRestaurant()
    return NextResponse.json(refreshedRestaurant ?? updatedRestaurant)
  } catch (error) {
    console.error("Error updating restaurant:", error)
    return NextResponse.json({ error: "Failed to update restaurant" }, { status: 500 })
  }
}
