import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchAddressFromCEP } from "@/lib/format-utils"
import { calculateDeliveryFee, buildFullAddress } from "@/src/services/deliveryFeeService"
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

    const fullAddress = customer.street
      ? `${customer.street}, ${customer.number || "s/n"} - ${customer.neighborhood}, ${customer.city}`
      : null

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

    const response = {
      exists: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: fullAddress,
        cep: customer.cep,
        street: customer.street,
        number: customer.number,
        neighborhood: customer.neighborhood,
        city: customer.city,
        complement: customer.complement,
        delivery_fee: customer.delivery_fee_default || 0,
      },
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
      metadata: { active_orders_count: activeOrdersFormatted.length },
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

    let delivery_fee_default = 0

    if (cep && street && neighborhood && city && restaurant.address) {
      console.log("[v0] Calculando taxa de entrega internamente...")

      try {
        // Montar endereço completo do cliente
        const customerAddress = buildFullAddress(street, number, neighborhood, city)

        // Usar endereço do restaurante já cadastrado
        const restaurantAddress = restaurant.address

        console.log("[v0] Endereços para cálculo:", {
          restaurante: restaurantAddress,
          cliente: customerAddress,
        })

        const feeResult = await calculateDeliveryFee(restaurant.id, restaurantAddress, customerAddress, neighborhood)

        if (feeResult.success) {
          delivery_fee_default = feeResult.fee || 0
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
        temCep: !!cep,
        temRua: !!street,
        temBairro: !!neighborhood,
        temCidade: !!city,
        temEnderecoRestaurante: !!restaurant.address,
      })
    }

    const cleanPhone = phone.replace(/\D/g, "")
    const cleanCEP = cep ? cep.replace(/\D/g, "") : null

    console.log("[v0] Criando cliente com dados:", {
      name,
      phone: cleanPhone,
      cep: cleanCEP,
      street,
      number,
      neighborhood,
      city,
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
        street,
        number,
        neighborhood,
        city,
        complement,
        notes,
        delivery_fee_default,
      })
      .select()
      .single()

    if (error) throw error

    const fullAddress = street ? `${street}, ${number || "s/n"} - ${neighborhood}, ${city}` : null

    console.log("[v0] Cliente criado com sucesso:", customer.id)

    const response = {
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: fullAddress,
        delivery_fee: delivery_fee_default,
      },
      message:
        delivery_fee_default > 0
          ? `Cliente cadastrado! Taxa de entrega: R$ ${delivery_fee_default.toFixed(2)}`
          : "Cliente cadastrado! Taxa de entrega não calculada (endereço incompleto)",
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
        delivery_fee_default,
        cep: cep || null,
        neighborhood: neighborhood || null,
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
