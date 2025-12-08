import { type NextRequest, NextResponse } from "next/server"
import { searchCustomers } from "@/src/services/customersService"
import { getCurrentRestaurant } from "@/src/services/restaurantsService"

export async function GET(request: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const searchTerm = searchParams.get("q") || searchParams.get("searchTerm")

    if (!searchTerm || searchTerm.trim().length < 2) {
      return NextResponse.json([])
    }

    const customers = await searchCustomers(restaurant.id, searchTerm)
    return NextResponse.json(customers)
  } catch (error) {
    console.error("Error searching customers:", error)
    return NextResponse.json({ error: "Failed to search customers" }, { status: 500 })
  }
}
