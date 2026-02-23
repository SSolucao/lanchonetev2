import { type NextRequest, NextResponse } from "next/server"
import { getCustomerById, updateCustomer, deleteCustomer, getCustomerByPhone } from "@/src/services/customersService"
import { calculateDeliveryFee, buildFullAddress } from "@/src/services/deliveryFeeService"
import { getFirstRestaurant } from "@/src/services/restaurantsService"
import { findDeliveryFeeForNeighborhood } from "@/src/services/deliveryRulesService"
import { normalizePhoneToInternational } from "@/lib/format-utils"
import { createClient } from "@/lib/supabase/server"

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
    delete body.allow_duplicate_name

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

    if (body.phone) {
      const duplicateCustomer = await getCustomerByPhone(existingCustomer.restaurant_id, body.phone, id)
      if (duplicateCustomer) {
        return NextResponse.json({ error: "Telefone já cadastrado" }, { status: 409 })
      }
    }

    const addressChanged =
      body.address_line !== existingCustomer.address_line ||
      body.cep !== existingCustomer.cep ||
      body.street !== existingCustomer.street ||
      body.number !== existingCustomer.number ||
      body.neighborhood !== existingCustomer.neighborhood ||
      body.city !== existingCustomer.city

    const hasManualFee = body.delivery_fee_default !== undefined && body.delivery_fee_default !== null
    let deliveryAvailable = existingCustomer.delivery_available ?? true
    const neighborhoodRuleId = typeof body.neighborhood_rule_id === "string" ? body.neighborhood_rule_id.trim() : ""
    delete body.neighborhood_rule_id

    if (!hasManualFee && neighborhoodRuleId) {
      const supabase = await createClient()
      const { data: selectedRule, error: selectedRuleError } = await supabase
        .from("delivery_rules")
        .select("id, neighborhood, fee")
        .eq("id", neighborhoodRuleId)
        .eq("restaurant_id", existingCustomer.restaurant_id)
        .maybeSingle()

      if (selectedRuleError) throw selectedRuleError
      if (!selectedRule || !selectedRule.neighborhood) {
        return NextResponse.json(
          { error: "INVALID_NEIGHBORHOOD_ID", message: "Bairro selecionado nao encontrado" },
          { status: 422 },
        )
      }

      body.neighborhood = String(selectedRule.neighborhood).trim()
      body.delivery_fee_default = Number(selectedRule.fee || 0)
      body.delivery_available = true
      body.delivery_rule_id = selectedRule.id
      deliveryAvailable = true
    } else if (!hasManualFee && typeof body.neighborhood === "string" && body.neighborhood.trim()) {
      const neighborhoodFee = await findDeliveryFeeForNeighborhood(existingCustomer.restaurant_id, body.neighborhood.trim())
      if (neighborhoodFee !== null) {
        body.delivery_fee_default = neighborhoodFee
        body.delivery_available = true
        body.delivery_rule_id = null
        deliveryAvailable = true
      } else if (addressChanged) {
        body.delivery_fee_default = 0
        body.delivery_available = false
        body.delivery_rule_id = null
        deliveryAvailable = false
      }
    }

    if (!hasManualFee && addressChanged && body.delivery_fee_default === undefined && body.cep && body.street && body.number) {
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

          const feeResult = await calculateDeliveryFee(
            restaurant.id,
            restaurant.address,
            customerAddress,
            body.neighborhood || existingCustomer.neighborhood || null,
          )

          console.log("[v0] Fee result:", feeResult)

          if (feeResult.success) {
            body.delivery_fee_default = feeResult.fee || 0
            deliveryAvailable = feeResult.rule_applied !== "none"
          }
        }
      } catch (feeError) {
        console.error("[v0] Error calculating delivery fee on update:", feeError)
        // Continue without updating fee
      }
    }

    if (hasManualFee) {
      body.delivery_available = true
      body.delivery_rule_id = null
    } else if (addressChanged) {
      body.delivery_available = deliveryAvailable
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
