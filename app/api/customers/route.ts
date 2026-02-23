import { type NextRequest, NextResponse } from "next/server"
import { listCustomers, createCustomer, getCustomerByPhone, findCustomersByName } from "@/src/services/customersService"
import { getCurrentRestaurant } from "@/src/services/restaurantsService"
import { calculateDeliveryFee } from "@/src/services/deliveryFeeService"
import { findDeliveryFeeForNeighborhood } from "@/src/services/deliveryRulesService"
import { normalizePhoneToInternational } from "@/lib/format-utils"
import { createClient } from "@/lib/supabase/server"

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
    let deliveryAvailable = true
    let deliveryRuleId: string | null = null

    const neighborhoodRuleId = typeof body.neighborhood_rule_id === "string" ? body.neighborhood_rule_id.trim() : ""
    if (neighborhoodRuleId) {
      const supabase = await createClient()
      const { data: selectedRule, error: selectedRuleError } = await supabase
        .from("delivery_rules")
        .select("id, neighborhood, fee")
        .eq("id", neighborhoodRuleId)
        .eq("restaurant_id", restaurant.id)
        .maybeSingle()

      if (selectedRuleError) throw selectedRuleError
      if (!selectedRule || !selectedRule.neighborhood) {
        return NextResponse.json(
          { error: "INVALID_NEIGHBORHOOD_ID", message: "Bairro selecionado nao encontrado" },
          { status: 422 },
        )
      }

      body.neighborhood = String(selectedRule.neighborhood).trim()
      deliveryFee = Number(selectedRule.fee || 0)
      deliveryAvailable = true
      deliveryRuleId = selectedRule.id
    }

    const hasNeighborhood = typeof body.neighborhood === "string" && body.neighborhood.trim().length > 0
    const hasCep = typeof body.cep === "string" && body.cep.trim().length > 0
    if (!neighborhoodRuleId && hasNeighborhood && !body.delivery_fee_default) {
      const neighborhoodFee = await findDeliveryFeeForNeighborhood(restaurant.id, body.neighborhood.trim())
      if (neighborhoodFee !== null) {
        deliveryFee = neighborhoodFee
        deliveryAvailable = true
      } else if (!hasCep) {
        deliveryFee = 0
        deliveryAvailable = false
      }
    }

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
            deliveryAvailable = feeResult.rule_applied !== "none"
          }
        }
      } catch (feeError) {
        console.error("Error calculating delivery fee:", feeError)
      }
    }

    const customer = await createCustomer({
      name: body.name,
      phone: normalizedPhone,
      cep: body.cep,
      address_line: body.address_line,
      street: body.street,
      number: body.number,
      neighborhood: body.neighborhood,
      city: body.city,
      complement: body.complement,
      notes: body.notes,
      restaurant_id: restaurant.id,
      delivery_fee_default: deliveryFee,
      delivery_available: deliveryAvailable,
      delivery_rule_id: deliveryRuleId,
    })

    return NextResponse.json(customer)
  } catch (error) {
    console.error("Error creating customer:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: "Failed to create customer", details: errorMessage }, { status: 500 })
  }
}
