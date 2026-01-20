import { type NextRequest, NextResponse } from "next/server"
import { listCustomers, createCustomer, getCustomerByPhone, findCustomersByName } from "@/src/services/customersService"
import { getCurrentRestaurant } from "@/src/services/restaurantsService"
import { calculateDeliveryFee } from "@/src/services/deliveryFeeService"
import { normalizePhoneToInternational } from "@/lib/format-utils"

export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    const customers = await listCustomers(restaurant.id)
    return NextResponse.json(customers)
  } catch (error) {
    console.error("Error listing customers:", error)
    return NextResponse.json({ error: "Failed to list customers" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    const body = await request.json()

    if (!body.name || !body.phone) {
      return NextResponse.json({ error: "Name and phone are required" }, { status: 400 })
    }

    let normalizedPhone = body.phone
    if (body.phone) {
      const normalized = normalizePhoneToInternational(body.phone)
      if (normalized) {
        normalizedPhone = normalized
      }
    }

    const allowDuplicateName = Boolean(body.allow_duplicate_name)

    const existingCustomer = await getCustomerByPhone(restaurant.id, normalizedPhone)
    if (existingCustomer) {
      return NextResponse.json({ error: "Telefone já cadastrado" }, { status: 409 })
    }

    if (!allowDuplicateName) {
      const nameMatches = await findCustomersByName(restaurant.id, String(body.name || ""))
      if (nameMatches.length > 0) {
        return NextResponse.json({ error: "NAME_EXISTS", matches: nameMatches }, { status: 409 })
      }
    }

    let deliveryFee = body.delivery_fee_default || 0

    if (body.cep && !body.delivery_fee_default && restaurant.address) {
      try {
        const customerAddress = [body.street, body.number, body.neighborhood, body.city].filter(Boolean).join(", ")

        if (customerAddress) {
          const feeResult = await calculateDeliveryFee(
            restaurant.id,
            restaurant.address,
            customerAddress,
            body.neighborhood || null,
          )

          if (feeResult.success) {
            deliveryFee = feeResult.fee || 0
          }
        }
      } catch (feeError) {
        console.error("Error calculating delivery fee:", feeError)
      }
    }

    const customer = await createCustomer({
      ...body,
      phone: normalizedPhone,
      restaurant_id: restaurant.id,
      delivery_fee_default: deliveryFee,
    })

    return NextResponse.json(customer)
  } catch (error) {
    console.error("Error creating customer:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: "Failed to create customer", details: errorMessage }, { status: 500 })
  }
}
