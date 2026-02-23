import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchAddressFromCEP } from "@/lib/format-utils"
import { calculateDeliveryFee, buildFullAddress } from "@/src/services/deliveryFeeService"
import { findDeliveryFeeForNeighborhood } from "@/src/services/deliveryRulesService"
import { logApiCall } from "@/src/services/apiLogService"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (supabaseUrl && serviceKey) {
    return createSupabaseClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  }
  return null
}

// GET /api/ai/customers?phone=5511933851277
export async function GET(request: Request) {
  const startedAt = Date.now()
  let statusCode = 200
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get("phone")

    if (!phone) {
      statusCode = 400
      await logApiCall({
        route: "/api/ai/customers",
        method: "GET",
        status_code: statusCode,
        duration_ms: Date.now() - startedAt,
        request_body: { query: Object.fromEntries(searchParams) },
        error: "Phone number is required",
      })
      return NextResponse.json({ error: "Phone number is required" }, { status: statusCode })
    }

    const supabase = await createClient()
    const admin = getSupabaseAdmin()
    if (!admin) {
      console.warn("[api/ai/customers] SUPABASE_SERVICE_ROLE_KEY ausente - last_order pode não aparecer")
    }

    // Get restaurant
    const { data: restaurant } = await supabase.from("restaurants").select("*").limit(1).single()
    if (!restaurant) {
      statusCode = 404
      await logApiCall({
        route: "/api/ai/customers",
        method: "GET",
        status_code: statusCode,
        duration_ms: Date.now() - startedAt,
        request_body: { query: Object.fromEntries(searchParams) },
        error: "No restaurant found",
      })
      return NextResponse.json({ error: "No restaurant found" }, { status: statusCode })
    }

    // Find customer by phone
    const cleanPhone = phone.replace(/\D/g, "")
    const { data: customer } = await supabase
      .from("customers")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("phone", cleanPhone)
      .single()

    if (!customer) {
      await logApiCall({
        route: "/api/ai/customers",
        method: "GET",
        status_code: statusCode,
        duration_ms: Date.now() - startedAt,
        request_body: { query: Object.fromEntries(searchParams) },
        response_body: { exists: false, customer: null },
        restaurant_id: restaurant.id,
      })
      return NextResponse.json({ exists: false, customer: null })
    }

    const supabaseRead = admin || supabase
    const { data: activeOrders } = await supabaseRead
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        total,
        created_at,
        tipo_pedido,
        order_items (
          id,
          quantity,
          unit_price,
          total_price,
          notes,
          products (
            id,
            name
          )
        )
      `)
      .eq("restaurant_id", restaurant.id)
      .eq("customer_id", customer.id)
      .in("status", ["NOVO", "EM_PREPARO", "SAIU_PARA_ENTREGA"])
      .order("created_at", { ascending: false })
      .limit(10)

    const { data: lastOrder } = await supabaseRead
      .from("orders")
      .select(
        `
        id,
        order_number,
        status,
        total,
        created_at,
        tipo_pedido,
        order_items (
          id,
          quantity,
          unit_price,
          total_price,
          notes,
          products (
            id,
            name
          )
        )
      `,
      )
      .eq("restaurant_id", restaurant.id)
      .eq("customer_id", customer.id)
      .neq("status", "CANCELADO")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const activeOrdersFormatted =
      activeOrders?.map((order: any) => ({
        order_number: order.order_number,
        status: order.status,
        total: order.total,
        date: order.created_at,
        type: order.tipo_pedido,
        items: order.order_items?.map((item: any) => ({
          product: item.products?.name || "Produto removido",
          quantity: item.quantity,
          price: item.unit_price,
          notes: item.notes,
        })),
      })) || []

    const lastOrderFormatted = lastOrder
      ? {
          order_number: lastOrder.order_number,
          status: lastOrder.status,
          total: lastOrder.total,
          date: lastOrder.created_at,
          type: lastOrder.tipo_pedido,
          items:
            lastOrder.order_items?.map((item: any) => ({
              product: item.products?.name || "Produto removido",
              quantity: item.quantity,
              price: item.unit_price,
              notes: item.notes,
            })) || [],
        }
      : null

    const response = {
      exists: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address_line: customer.address_line || null,
        neighborhood: customer.neighborhood,
        delivery_fee: customer.delivery_fee_default || 0,
      },
      last_order: lastOrderFormatted,
      active_orders: activeOrdersFormatted,
    }

    await logApiCall({
      route: "/api/ai/customers",
      method: "GET",
      status_code: statusCode,
      duration_ms: Date.now() - startedAt,
      request_body: { query: Object.fromEntries(searchParams) },
      response_body: response,
      restaurant_id: restaurant.id,
      customer_id: customer.id,
      metadata: {
        active_orders_count: activeOrdersFormatted.length,
        has_last_order: !!lastOrderFormatted,
        last_order_status: lastOrderFormatted?.status || null,
      },
    })

    return NextResponse.json(response)
  } catch (error) {
    statusCode = 500
    console.error("[v0] Error in GET /api/ai/customers:", error)
    await logApiCall({
      route: "/api/ai/customers",
      method: "GET",
      status_code: statusCode,
      duration_ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Internal server error" }, { status: statusCode })
  }
}

// POST /api/ai/customers
export async function POST(request: Request) {
  const startedAt = Date.now()
  let statusCode = 200
  try {
    const body = await request.json()
    console.log("[v0] AI Customers API - Body recebido:", JSON.stringify(body, null, 2))

    let { name, phone, cep, street, number, neighborhood, city, complement, notes } = body

    if (!name || !phone) {
      statusCode = 400
      await logApiCall({
        route: "/api/ai/customers",
        method: "POST",
        status_code: statusCode,
        duration_ms: Date.now() - startedAt,
        request_body: body,
        error: "Name and phone are required",
      })
      return NextResponse.json({ error: "Name and phone are required" }, { status: statusCode })
    }

    const supabase = await createClient()

    // Get restaurant with full address
    const { data: restaurant } = await supabase.from("restaurants").select("*").limit(1).single()
    if (!restaurant) {
      statusCode = 404
      await logApiCall({
        route: "/api/ai/customers",
        method: "POST",
        status_code: statusCode,
        duration_ms: Date.now() - startedAt,
        request_body: body,
        error: "No restaurant found",
      })
      return NextResponse.json({ error: "No restaurant found" }, { status: statusCode })
    }

    const cleanPhone = phone.replace(/\D/g, "")
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("phone", cleanPhone)
      .single()

    if (cep && (!street || !neighborhood || !city)) {
      console.log("[v0] Buscando endereço via ViaCEP para CEP:", cep)
      try {
        const cleanCEP = cep.replace(/\D/g, "")
        const addressData = await fetchAddressFromCEP(cleanCEP)
        if (addressData && !addressData.erro) {
          console.log("[v0] Endereço encontrado via ViaCEP:", addressData)
          street = street || addressData.logradouro
          neighborhood = neighborhood || addressData.bairro
          city = city || addressData.localidade
        } else {
          console.log("[v0] ViaCEP não retornou dados para o CEP:", cep)
        }
      } catch (err) {
        console.error("[v0] Erro ao buscar endereço via ViaCEP:", err)
      }
    }

    const hasNeighborhood = typeof neighborhood === "string" && neighborhood.trim().length > 0
    const hasCep = typeof cep === "string" && cep.trim().length > 0
    if (hasNeighborhood && !hasCep) {
      const neighborhoodFee = await findDeliveryFeeForNeighborhood(restaurant.id, neighborhood.trim())
      if (neighborhoodFee === null) {
        statusCode = 422
        const response = {
          error: "NEIGHBORHOOD_NOT_FOUND",
          message: "Bairro nao cadastrado. Informe o CEP para calcular a taxa por KM.",
          require_cep: true,
        }

        await logApiCall({
          route: "/api/ai/customers",
          method: "POST",
          status_code: statusCode,
          duration_ms: Date.now() - startedAt,
          request_body: body,
          response_body: response,
          restaurant_id: restaurant.id,
        })

        return NextResponse.json(response, { status: statusCode })
      }
    }

    const cleanCEP = cep ? cep.replace(/\D/g, "") : null
    const mergedCustomer = existingCustomer
      ? {
          cep: cleanCEP ?? existingCustomer.cep,
          street: street || existingCustomer.street,
          number: number || existingCustomer.number,
          neighborhood: neighborhood || existingCustomer.neighborhood,
          city: city || existingCustomer.city,
        }
      : {
          cep: cleanCEP,
          street,
          number,
          neighborhood,
          city,
        }

    const hasAddressUpdate = [cep, street, number, neighborhood, city].some((value) => {
      if (value === undefined || value === null) return false
      return String(value).trim().length > 0
    })
    let delivery_fee_default = existingCustomer?.delivery_fee_default || 0
    let delivery_available = existingCustomer?.delivery_available ?? true
    let delivery_rule_applied: string | null = null
    const hasCompleteAddress =
      mergedCustomer.cep && mergedCustomer.street && mergedCustomer.number && mergedCustomer.neighborhood && mergedCustomer.city

    if (hasCompleteAddress && restaurant.address && (!existingCustomer || hasAddressUpdate)) {
      console.log("[v0] Calculando taxa de entrega internamente...")

      try {
        // Montar endereço completo do cliente
        const customerAddress = buildFullAddress(
          mergedCustomer.street,
          mergedCustomer.number,
          mergedCustomer.neighborhood,
          mergedCustomer.city,
        )

        // Usar endereço do restaurante já cadastrado
        const restaurantAddress = restaurant.address

        console.log("[v0] Endereços para cálculo:", {
          restaurante: restaurantAddress,
          cliente: customerAddress,
        })

        const feeResult = await calculateDeliveryFee(
          restaurant.id,
          restaurantAddress,
          customerAddress,
          mergedCustomer.neighborhood,
        )

        if (feeResult.success) {
          delivery_fee_default = feeResult.fee || 0
          delivery_available = feeResult.rule_applied !== "none"
          delivery_rule_applied = feeResult.rule_applied
          console.log("[v0] Taxa calculada:", {
            distancia: feeResult.distance_km + " km",
            taxa: "R$ " + delivery_fee_default,
            regra: feeResult.rule_applied,
          })
        } else {
          console.log("[v0] Cálculo não retornou taxa:", feeResult)
        }
      } catch (err) {
        console.error("[v0] Erro ao calcular taxa de entrega:", err)
      }
    } else {
      console.log("[v0] Pulando cálculo de frete - dados incompletos:", {
        temCep: !!mergedCustomer.cep,
        temRua: !!mergedCustomer.street,
        temBairro: !!mergedCustomer.neighborhood,
        temCidade: !!mergedCustomer.city,
        temEnderecoRestaurante: !!restaurant.address,
      })
    }

    const trimmedStreet = street?.trim() || null
    const trimmedNeighborhood = neighborhood?.trim() || null
    const trimmedCity = city?.trim() || null
    const trimmedNumber = number?.trim() || null
    const trimmedComplement = complement?.trim() || null
    const trimmedNotes = notes?.trim() || null

    if (existingCustomer) {
      console.log("[v0] Atualizando cliente com dados:", {
        id: existingCustomer.id,
        name,
        phone: cleanPhone,
        cep: cleanCEP,
        street: trimmedStreet,
        number: trimmedNumber,
        neighborhood: trimmedNeighborhood,
        city: trimmedCity,
        delivery_fee_default,
        delivery_available,
      })

      const updates: Record<string, any> = {
        name,
        phone: cleanPhone,
        delivery_fee_default,
        delivery_available,
      }

      if (cleanCEP) updates.cep = cleanCEP
      if (trimmedStreet) updates.street = trimmedStreet
      if (trimmedNumber) updates.number = trimmedNumber
      if (trimmedNeighborhood) updates.neighborhood = trimmedNeighborhood
      if (trimmedCity) updates.city = trimmedCity
      if (trimmedComplement) updates.complement = trimmedComplement
      if (trimmedNotes) updates.notes = trimmedNotes

      const { data: customer, error } = await supabase
        .from("customers")
        .update(updates)
        .eq("id", existingCustomer.id)
        .select()
        .single()

      if (error) throw error

      const fullAddress = customer.street
        ? `${customer.street}, ${customer.number || "s/n"} - ${customer.neighborhood}, ${customer.city}`
        : null

      console.log("[v0] Cliente atualizado com sucesso:", customer.id)

      const responseMessage =
        delivery_rule_applied === "none"
          ? "Entrega indisponivel para este endereco. Valor de entrega 0; nao podemos fazer entrega para esse cliente no momento."
          : customer.delivery_fee_default && customer.delivery_fee_default > 0
            ? `Cadastro atualizado! Taxa de entrega: R$ ${customer.delivery_fee_default.toFixed(2)}`
            : "Cadastro atualizado! Taxa de entrega nao calculada (endereco incompleto)"

      const response = {
        success: true,
        updated: true,
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          address: fullAddress,
          delivery_fee: customer.delivery_fee_default || 0,
          delivery_available: customer.delivery_available ?? true,
        },
        message: responseMessage,
        rule_applied: customer.delivery_fee_default && customer.delivery_fee_default > 0 ? "bairro ou km aplicado" : "nenhuma regra aplicada",
      }

      await logApiCall({
        route: "/api/ai/customers",
        method: "POST",
        status_code: statusCode,
        duration_ms: Date.now() - startedAt,
        request_body: body,
        response_body: response,
        restaurant_id: restaurant.id,
        customer_id: customer.id,
        metadata: {
          updated: true,
          delivery_fee_default: customer.delivery_fee_default || 0,
          delivery_available: customer.delivery_available ?? true,
          cep: cleanCEP || null,
          neighborhood: trimmedNeighborhood || null,
        },
      })

      return NextResponse.json(response)
    }

    console.log("[v0] Criando cliente com dados:", {
      name,
      phone: cleanPhone,
      cep: cleanCEP,
      street: trimmedStreet,
      number: trimmedNumber,
      neighborhood: trimmedNeighborhood,
      city: trimmedCity,
      delivery_fee_default,
    })

    // Create customer
    const { data: customer, error } = await supabase
      .from("customers")
      .insert({
        restaurant_id: restaurant.id,
        name,
        phone: cleanPhone,
        cep: cleanCEP,
        street: trimmedStreet,
        number: trimmedNumber,
        neighborhood: trimmedNeighborhood,
        city: trimmedCity,
        complement: trimmedComplement,
        notes: trimmedNotes,
        delivery_fee_default,
        delivery_available,
      })
      .select()
      .single()

    if (error) throw error

    const fullAddress = trimmedStreet
      ? `${trimmedStreet}, ${trimmedNumber || "s/n"} - ${trimmedNeighborhood}, ${trimmedCity}`
      : null

    console.log("[v0] Cliente criado com sucesso:", customer.id)

    const responseMessage =
      delivery_rule_applied === "none"
        ? "Entrega indisponivel para este endereco. Valor de entrega 0; nao podemos fazer entrega para esse cliente no momento."
        : delivery_fee_default > 0
          ? `Cliente cadastrado! Taxa de entrega: R$ ${delivery_fee_default.toFixed(2)}`
          : "Cliente cadastrado! Taxa de entrega nao calculada (endereco incompleto)"

    const response = {
      success: true,
      created: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: fullAddress,
        delivery_fee: delivery_fee_default,
        delivery_available: customer.delivery_available ?? true,
      },
      message: responseMessage,
      rule_applied: delivery_fee_default > 0 ? "bairro ou km aplicado" : "nenhuma regra aplicada",
    }

    await logApiCall({
      route: "/api/ai/customers",
      method: "POST",
      status_code: statusCode,
      duration_ms: Date.now() - startedAt,
      request_body: body,
      response_body: response,
      restaurant_id: restaurant.id,
      customer_id: customer.id,
      metadata: {
        created: true,
        delivery_fee_default,
        delivery_available,
        cep: cleanCEP || null,
        neighborhood: trimmedNeighborhood || null,
      },
    })

    return NextResponse.json(response)
  } catch (error) {
    statusCode = 500
    console.error("[v0] Error in POST /api/ai/customers:", error)
    await logApiCall({
      route: "/api/ai/customers",
      method: "POST",
      status_code: statusCode,
      duration_ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to create customer" }, { status: statusCode })
  }
}
