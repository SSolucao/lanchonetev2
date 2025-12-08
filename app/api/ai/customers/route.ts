import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchAddressFromCEP } from "@/lib/format-utils"
import { calculateDeliveryFee, buildFullAddress } from "@/src/services/deliveryFeeService"

// GET /api/ai/customers?phone=5511933851277
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get("phone")

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Get restaurant
    const { data: restaurant } = await supabase.from("restaurants").select("*").limit(1).single()
    if (!restaurant) {
      return NextResponse.json({ error: "No restaurant found" }, { status: 404 })
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
      return NextResponse.json({ exists: false, customer: null })
    }

    const fullAddress = customer.street
      ? `${customer.street}, ${customer.number || "s/n"} - ${customer.neighborhood}, ${customer.city}`
      : null

    const { data: lastOrder } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        total,
        created_at,
        order_type,
        order_items (
          quantity,
          price,
          notes,
          products (
            id,
            name
          )
        )
      `)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    // Formatar dados do último pedido se existir
    const lastOrderFormatted = lastOrder
      ? {
          order_number: lastOrder.order_number,
          status: lastOrder.status,
          total: lastOrder.total,
          date: lastOrder.created_at,
          type: lastOrder.order_type,
          items: lastOrder.order_items?.map((item: any) => ({
            product: item.products?.name || "Produto removido",
            quantity: item.quantity,
            price: item.price,
            notes: item.notes,
          })),
        }
      : null

    return NextResponse.json({
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
      last_order: lastOrderFormatted,
    })
  } catch (error) {
    console.error("[v0] Error in GET /api/ai/customers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/ai/customers
export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log("[v0] AI Customers API - Body recebido:", JSON.stringify(body, null, 2))

    let { name, phone, cep, street, number, neighborhood, city, complement, notes } = body

    if (!name || !phone) {
      return NextResponse.json({ error: "Name and phone are required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Get restaurant with full address
    const { data: restaurant } = await supabase.from("restaurants").select("*").limit(1).single()
    if (!restaurant) {
      return NextResponse.json({ error: "No restaurant found" }, { status: 404 })
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

        const feeResult = await calculateDeliveryFee(restaurant.id, restaurantAddress, customerAddress)

        if (feeResult.success && feeResult.fee > 0) {
          delivery_fee_default = feeResult.fee
          console.log("[v0] Taxa calculada:", {
            distancia: feeResult.distance_km + " km",
            taxa: "R$ " + feeResult.fee,
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

    return NextResponse.json({
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
    })
  } catch (error) {
    console.error("[v0] Error in POST /api/ai/customers:", error)
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 })
  }
}
