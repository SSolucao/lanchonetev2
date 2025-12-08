import { type NextRequest, NextResponse } from "next/server"
import { getCustomerById, updateCustomer, deleteCustomer } from "@/src/services/customersService"
import { calculateDeliveryFee, buildFullAddress } from "@/src/services/deliveryFeeService"
import { getFirstRestaurant } from "@/src/services/restaurantsService"
import { normalizePhoneToInternational } from "@/lib/format-utils"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const customer = await getCustomerById(id)
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }
    return NextResponse.json(customer)
  } catch (error) {
    console.error("[v0] Error getting customer:", error)
    return NextResponse.json({ error: "Failed to get customer" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    console.log("[v0] PUT /api/customers/:id - Starting update for:", id)

    if (body.phone) {
      const normalizedPhone = normalizePhoneToInternational(body.phone)
      if (normalizedPhone) {
        body.phone = normalizedPhone
      }
    }

    const existingCustomer = await getCustomerById(id)
    if (!existingCustomer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    const addressChanged =
      body.cep !== existingCustomer.cep ||
      body.street !== existingCustomer.street ||
      body.number !== existingCustomer.number ||
      body.neighborhood !== existingCustomer.neighborhood ||
      body.city !== existingCustomer.city

    if (addressChanged && body.cep && body.street && body.number) {
      try {
        const restaurant = await getFirstRestaurant()
        if (restaurant?.cep_origem && restaurant?.address) {
          const customerAddress = buildFullAddress(
            body.street,
            body.number,
            body.neighborhood || "",
            body.city || "",
            body.state || "SP",
          )

          console.log("[v0] Recalculating delivery fee...")
          console.log("[v0] Restaurant address:", restaurant.address)
          console.log("[v0] Customer address:", customerAddress)

          const feeResult = await calculateDeliveryFee(restaurant.id, restaurant.address, customerAddress)

          console.log("[v0] Fee result:", feeResult)

          if (feeResult.success) {
            body.delivery_fee_default = feeResult.fee
          }
        }
      } catch (feeError) {
        console.error("[v0] Error calculating delivery fee on update:", feeError)
        // Continue without updating fee
      }
    }

    const customer = await updateCustomer(id, body)
    console.log("[v0] Customer updated:", customer.id)

    return NextResponse.json(customer)
  } catch (error) {
    console.error("[v0] Error updating customer:", error)
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Check if customer exists
    const customer = await getCustomerById(id)
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    console.log("[v0] Soft deleting customer:", id, customer.name)
    await deleteCustomer(id)
    console.log("[v0] Customer marked as inactive successfully")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting customer:", error)
    return NextResponse.json({ error: "Failed to delete customer" }, { status: 500 })
  }
}
