import { NextResponse } from "next/server"
import { getNextOrderNumber } from "@/src/services/ordersService"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const restaurantId = searchParams.get("restaurantId")

    if (!restaurantId) {
      return NextResponse.json({ error: "restaurantId is required" }, { status: 400 })
    }

    const nextNumber = await getNextOrderNumber(restaurantId)

    return NextResponse.json(nextNumber)
  } catch (error) {
    console.error("[v0] Error getting next order number:", error)
    return NextResponse.json({ error: "Failed to get next order number" }, { status: 500 })
  }
}
