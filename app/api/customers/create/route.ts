import { type NextRequest, NextResponse } from "next/server"
import { createCustomer, getCustomerByPhone } from "@/src/services/customersService"
import { normalizePhoneToInternational } from "@/lib/format-utils"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.restaurant_id) {
      return NextResponse.json({ error: "Restaurant ID required" }, { status: 400 })
    }

    if (!body.name || !body.phone) {
      return NextResponse.json({ error: "Name and phone are required" }, { status: 400 })
    }

    let normalizedPhone = body.phone
    const normalized = normalizePhoneToInternational(body.phone)
    if (normalized) {
      normalizedPhone = normalized
    }

    const existingCustomer = await getCustomerByPhone(body.restaurant_id, normalizedPhone)
    if (existingCustomer) {
      return NextResponse.json({ error: "Telefone já cadastrado" }, { status: 409 })
    }

    const customer = await createCustomer({ ...body, phone: normalizedPhone })
    return NextResponse.json(customer)
  } catch (error) {
    console.error("Error creating customer:", error)
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 })
  }
}
