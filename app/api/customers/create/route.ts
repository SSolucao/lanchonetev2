import { type NextRequest, NextResponse } from "next/server"
import { createCustomer } from "@/src/services/customersService"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.restaurant_id) {
      return NextResponse.json({ error: "Restaurant ID required" }, { status: 400 })
    }

    if (!body.name || !body.phone) {
      return NextResponse.json({ error: "Name and phone are required" }, { status: 400 })
    }

    const customer = await createCustomer(body)
    return NextResponse.json(customer)
  } catch (error) {
    console.error("Error creating customer:", error)
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 })
  }
}
