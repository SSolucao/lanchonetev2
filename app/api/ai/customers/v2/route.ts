import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchAddressFromCEP, normalizePhoneToInternational } from "@/lib/format-utils"
import { buildFullAddress, calculateDeliveryFee } from "@/src/services/deliveryFeeService"
import { logApiCall } from "@/src/services/apiLogService"

interface ParsedAddressLine {
  street: string | null
  number: string | null
  complement: string | null
}

function parseAddressLine(input: unknown): ParsedAddressLine {
  if (typeof input !== "string") {
    return { street: null, number: null, complement: null }
  }

  const line = input.trim()
  if (!line) {
    return { street: null, number: null, complement: null }
  }

  const parts = line
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length >= 2) {
    const street = parts[0] || null
    const numberMatch = parts[1].match(/^(\S+)\s*(.*)$/)
    const number = numberMatch?.[1]?.trim() || null
    const complementSegments: string[] = []

    if (numberMatch?.[2]?.trim()) {
      complementSegments.push(numberMatch[2].trim())
    }

    if (parts.length > 2) {
      complementSegments.push(parts.slice(2).join(", "))
    }

    return {
      street,
      number,
      complement: complementSegments.join(", ") || null,
    }
  }

  const inlineMatch = line.match(/^(.*?)(?:\s+)(\d+[A-Za-z0-9\/-]*)\s*(.*)$/)
  if (inlineMatch) {
    return {
      street: inlineMatch[1]?.trim() || null,
      number: inlineMatch[2]?.trim() || null,
      complement: inlineMatch[3]?.trim() || null,
    }
  }

  return {
    street: line,
    number: null,
    complement: null,
  }
}

function trimText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(request: Request) {
  const startedAt = Date.now()
  let statusCode = 200

  try {
    const body = await request.json()
    const name = trimText(body?.name)
    const normalizedPhone = normalizePhoneToInternational(String(body?.phone || ""))
    const cepInputProvided = Object.prototype.hasOwnProperty.call(body || {}, "cep")
    const addressLineProvided = Object.prototype.hasOwnProperty.call(body || {}, "address_line")
    const notesProvided = Object.prototype.hasOwnProperty.call(body || {}, "notes")
    const cleanCEP = trimText(body?.cep)?.replace(/\D/g, "") || null
    const rawAddressLine = trimText(body?.address_line)
    const notes = trimText(body?.notes)
    const neighborhoodId = trimText(body?.neighborhood_id)

    if (!name || !normalizedPhone) {
      statusCode = 400
      return NextResponse.json(
        { error: "Name and valid phone are required" },
        {
          status: statusCode,
        },
      )
    }

    const supabase = await createClient()
    const { data: restaurant } = await supabase.from("restaurants").select("id, address").limit(1).single()

    if (!restaurant) {
      statusCode = 404
      return NextResponse.json({ error: "No restaurant found" }, { status: statusCode })
    }

    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("phone", normalizedPhone)
      .single()

    const baseCustomer = existingCustomer || {}

    let street: string | null = null
    let number: string | null = null
    let complement: string | null = null
    let neighborhood: string | null = null
    let city: string | null = null

    const parsedAddress = parseAddressLine(rawAddressLine)
    street = parsedAddress.street
    number = parsedAddress.number
    complement = parsedAddress.complement

    if (cleanCEP && cleanCEP.length === 8) {
      const cepData = await fetchAddressFromCEP(cleanCEP)
      if (cepData) {
        street = street || trimText(cepData.logradouro)
        neighborhood = trimText(cepData.bairro)
        city = trimText(cepData.localidade)
      }
    }

    let deliveryFee = Number(existingCustomer?.delivery_fee_default || 0)
    let deliveryAvailable = existingCustomer?.delivery_available ?? false
    let deliveryRuleId: string | null = existingCustomer?.delivery_rule_id || null
    let feeSource: "rule_id" | "distance_km" | "none" | "existing" = "existing"
    let ruleApplied: string | null = null

    if (neighborhoodId) {
      const { data: selectedRule, error: selectedRuleError } = await supabase
        .from("delivery_rules")
        .select("id, neighborhood, fee, restaurant_id")
        .eq("id", neighborhoodId)
        .eq("restaurant_id", restaurant.id)
        .maybeSingle()

      if (selectedRuleError) throw selectedRuleError

      if (!selectedRule || !selectedRule.neighborhood) {
        statusCode = 422
        return NextResponse.json(
          {
            error: "INVALID_NEIGHBORHOOD_ID",
            message: "Neighborhood rule not found for current restaurant",
          },
          { status: statusCode },
        )
      }

      neighborhood = String(selectedRule.neighborhood)
      deliveryFee = Number(selectedRule.fee || 0)
      deliveryAvailable = true
      deliveryRuleId = selectedRule.id
      feeSource = "rule_id"
      ruleApplied = `Bairro: ${neighborhood}`
    } else {
      const hasAddressForDistance = Boolean(restaurant.address && (street || baseCustomer.street) && neighborhood && city)

      if (hasAddressForDistance) {
        const customerAddress = buildFullAddress(
          (street || baseCustomer.street) as string,
          number || baseCustomer.number || null,
          neighborhood as string,
          city as string,
        )
        const feeResult = await calculateDeliveryFee(restaurant.id, restaurant.address, customerAddress, neighborhood)

        if (feeResult.success) {
          deliveryFee = Number(feeResult.fee || 0)
          deliveryAvailable = feeResult.rule_applied !== "none"
          deliveryRuleId = null
          feeSource = deliveryAvailable ? "distance_km" : "none"
          ruleApplied = feeResult.rule_applied || null
        } else {
          deliveryFee = 0
          deliveryAvailable = false
          deliveryRuleId = null
          feeSource = "none"
        }
      } else if (rawAddressLine || cleanCEP) {
        deliveryFee = 0
        deliveryAvailable = false
        deliveryRuleId = null
        feeSource = "none"
      }
    }

    const finalCep = cepInputProvided ? cleanCEP : (baseCustomer.cep ?? null)
    const finalAddressLine = addressLineProvided ? rawAddressLine : (baseCustomer.address_line ?? null)
    const finalStreet = street || baseCustomer.street || null
    const finalNumber = number || baseCustomer.number || null
    const finalNeighborhood = neighborhood || baseCustomer.neighborhood || null
    const finalCity = city || baseCustomer.city || null
    const finalComplement = complement || baseCustomer.complement || null
    const finalNotes = notesProvided ? notes : (baseCustomer.notes ?? null)

    const payload: Record<string, unknown> = {
      name,
      phone: normalizedPhone,
      notes: finalNotes,
      cep: finalCep,
      address_line: finalAddressLine,
      street: finalStreet,
      number: finalNumber,
      neighborhood: finalNeighborhood,
      city: finalCity,
      complement: finalComplement,
      delivery_fee_default: deliveryFee,
      delivery_available: deliveryAvailable,
      delivery_rule_id: deliveryRuleId,
    }

    let customer: any
    if (existingCustomer) {
      const { data, error } = await supabase
        .from("customers")
        .update(payload)
        .eq("id", existingCustomer.id)
        .select()
        .single()

      if (error) throw error
      customer = data
    } else {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          ...payload,
          restaurant_id: restaurant.id,
          active: true,
        })
        .select()
        .single()

      if (error) throw error
      customer = data
    }

    const response = {
      success: true,
      updated: Boolean(existingCustomer),
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        cep: customer.cep,
        address_line: customer.address_line,
        neighborhood: customer.neighborhood,
        delivery_fee: customer.delivery_fee_default || 0,
        delivery_available: customer.delivery_available ?? false,
        delivery_rule_id: customer.delivery_rule_id || null,
      },
      fee_source: feeSource,
      rule_applied: ruleApplied,
    }

    await logApiCall({
      route: "/api/ai/customers/v2",
      method: "POST",
      status_code: statusCode,
      duration_ms: Date.now() - startedAt,
      request_body: {
        ...body,
        phone: normalizedPhone,
        cep: cleanCEP,
      },
      response_body: response,
      restaurant_id: restaurant.id,
      customer_id: customer.id,
    })

    return NextResponse.json(response)
  } catch (error) {
    statusCode = 500
    console.error("[v0] Error in POST /api/ai/customers/v2:", error)

    await logApiCall({
      route: "/api/ai/customers/v2",
      method: "POST",
      status_code: statusCode,
      duration_ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json({ error: "Failed to create or update customer (v2)" }, { status: statusCode })
  }
}
