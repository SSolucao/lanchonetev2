import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createOrderWithItems, getNextOrderNumber } from "@/src/services/ordersService"
import { logApiCall } from "@/src/services/apiLogService"

function parseItensPedido(itensPedido: string): Array<{
  product_id: string
  quantity: number
  notes: string | null
}> {
  if (!itensPedido || itensPedido.trim() === "") {
    return []
  }

  const items = itensPedido
    .split(";")
    .map((itemStr) => {
      const parts = itemStr.trim().split(":")
      const product_id = parts[0]?.trim()
      const quantity = Number.parseInt(parts[1]?.trim() || "1", 10)
      const notes = parts[2]?.trim() || null

      // Se notes for "null" ou vazio, usar null
      const finalNotes = notes && notes.toLowerCase() !== "null" ? notes : null

      return {
        product_id,
        quantity: isNaN(quantity) ? 1 : quantity,
        notes: finalNotes,
      }
    })
    .filter((item) => item.product_id) // Remove itens inválidos

  return items
}

// POST /api/ai/orders - Create order from AI agent
export async function POST(request: Request) {
  const startedAt = Date.now()
  let statusCode = 200
  try {
    const body = await request.json()
    console.log("[v0] AI Order Request Body:", JSON.stringify(body, null, 2))

    const {
      customer_id,
      customer_phone, // Mantido para compatibilidade
      itens_pedido, // "id:qtd:obs;id:qtd;id:qtd:obs"
      items, // Formato antigo mantido para compatibilidade
      tipo_pedido,
      service_type, // Deprecated
      payment_method_name,
      notes,
    } = body

    const supabase = await createClient()

    // Get restaurant
    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("*")
      .limit(1)
      .single()

    if (restaurantError || !restaurant) {
      statusCode = 500
      await logApiCall({
        route: "/api/ai/orders",
        method: "POST",
        status_code: statusCode,
        duration_ms: Date.now() - startedAt,
        request_body: body,
        error: "Failed to fetch restaurant",
      })
      return NextResponse.json({ error: "Failed to fetch restaurant" }, { status: statusCode })
    }

    let customer = null

    if (customer_id) {
      console.log("[v0] Buscando cliente por ID:", customer_id)
      const { data } = await supabase.from("customers").select("*").eq("id", customer_id).single()
      customer = data
    } else if (customer_phone) {
      console.log("[v0] Buscando cliente por telefone:", customer_phone)
      const cleanPhone = customer_phone.replace(/\D/g, "")
      const { data } = await supabase
        .from("customers")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .eq("phone", cleanPhone)
        .single()
      customer = data
    }

    if (!customer) {
      statusCode = 400
      await logApiCall({
        route: "/api/ai/orders",
        method: "POST",
        status_code: statusCode,
        duration_ms: Date.now() - startedAt,
        request_body: body,
        error: "Customer not found",
        restaurant_id: restaurant.id,
      })
      return NextResponse.json(
        {
          error: "Customer not found. Please create customer first using /api/ai/customers",
        },
        { status: statusCode },
      )
    }

    let parsedItems: Array<{ product_id: string; quantity: number; notes: string | null }> = []

    if (itens_pedido) {
      console.log("[v0] Parseando itens_pedido:", itens_pedido)
      parsedItems = parseItensPedido(itens_pedido)
      console.log("[v0] Itens parseados:", parsedItems)
    } else if (items && Array.isArray(items)) {
      console.log("[v0] Usando formato antigo de items")
      parsedItems = items.map((item: any) => ({
        product_id: item.product_id,
        quantity: item.quantity || 1,
        notes: item.notes || null,
      }))
    }

    if (parsedItems.length === 0) {
      statusCode = 400
      await logApiCall({
        route: "/api/ai/orders",
        method: "POST",
        status_code: statusCode,
        duration_ms: Date.now() - startedAt,
        request_body: body,
        error: "No items provided",
        restaurant_id: restaurant.id,
        customer_id: customer.id,
      })
      return NextResponse.json(
        {
          error: "No items provided. Use itens_pedido='id:qtd:obs;id:qtd' or items array",
        },
        { status: statusCode },
      )
    }

    // Payment method is required
    if (!payment_method_name || String(payment_method_name).trim() === "") {
      statusCode = 400
      await logApiCall({
        route: "/api/ai/orders",
        method: "POST",
        status_code: statusCode,
        duration_ms: Date.now() - startedAt,
        request_body: body,
        error: "payment_method_name is required",
        restaurant_id: restaurant.id,
        customer_id: customer.id,
      })
      return NextResponse.json({ error: "payment_method_name is required" }, { status: statusCode })
    }

    // Get payment method if name provided
    let payment_method_id = null
    let payment_method_display = null

    const { data: paymentMethod } = await supabase
      .from("payment_methods")
      .select("id, name")
      .eq("restaurant_id", restaurant.id)
      .ilike("name", payment_method_name)
      .limit(1)
      .single()

    if (!paymentMethod) {
      statusCode = 400
      await logApiCall({
        route: "/api/ai/orders",
        method: "POST",
        status_code: statusCode,
        duration_ms: Date.now() - startedAt,
        request_body: body,
        error: `Payment method not found: ${payment_method_name}`,
        restaurant_id: restaurant.id,
        customer_id: customer.id,
      })
      return NextResponse.json({ error: `Payment method not found: ${payment_method_name}` }, { status: statusCode })
    }

    payment_method_id = paymentMethod.id
    payment_method_display = paymentMethod.name

    // Get next order number
    const orderNumber = await getNextOrderNumber(restaurant.id)

    // Calculate totals and build order items
    let subtotal = 0
    const orderItems: Array<{
      product_id: string
      quantity: number
      unit_price: number
      total_price: number
      notes: string | null
    }> = []
    const itemsDetails: Array<{
      name: string
      quantity: number
      unit_price: number
      total: number
      notes: string | null
    }> = []

    for (const item of parsedItems) {
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id, name, price")
        .eq("id", item.product_id)
        .single()

      if (productError || !product) {
        return NextResponse.json(
          {
            error: `Produto não encontrado: ${item.product_id}`,
          },
          { status: 400 },
        )
      }

      const itemTotal = product.price * item.quantity
      subtotal += itemTotal

      orderItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: product.price,
        total_price: itemTotal,
        notes: item.notes,
      })

      itemsDetails.push({
        name: product.name,
        quantity: item.quantity,
        unit_price: product.price,
        total: itemTotal,
        notes: item.notes,
      })
    }

    // Determine tipo_pedido
    let finalTipoPedido: "BALCAO" | "RETIRADA" | "ENTREGA" = "ENTREGA"

    if (tipo_pedido) {
      const upperTipo = tipo_pedido.toUpperCase()
      if (upperTipo === "BALCAO" || upperTipo === "RETIRADA" || upperTipo === "ENTREGA") {
        finalTipoPedido = upperTipo
      }
    } else if (service_type) {
      const serviceTypeMap: Record<string, "BALCAO" | "RETIRADA" | "ENTREGA"> = {
        DELIVERY: "ENTREGA",
        PICKUP: "RETIRADA",
        COUNTER: "BALCAO",
        RETIRADA: "RETIRADA",
        BALCAO: "BALCAO",
        ENTREGA: "ENTREGA",
      }
      finalTipoPedido = serviceTypeMap[service_type.toUpperCase()] || "ENTREGA"
    }

    // Calculate delivery fee (only for ENTREGA)
    const deliveryFee = finalTipoPedido === "ENTREGA" ? customer.delivery_fee_default || 0 : 0

    const total = subtotal + deliveryFee

    const orderData = {
      restaurant_id: restaurant.id,
      order_number: orderNumber,
      customer_id: customer.id,
      tipo_pedido: finalTipoPedido,
      channel: "AGENTE",
      status: "NOVO" as const,
      subtotal,
      delivery_fee: deliveryFee,
      total,
      payment_method_id,
      payment_status: "PENDENTE" as const,
      notes: notes || "Pedido via agente IA",
    }

    const { order, items: createdItems } = await createOrderWithItems(orderData, orderItems)

    const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`

    // Build message for agent
    let message = `Pedido #${order.order_number} criado com sucesso!\n`
    message += `\nItens:\n`
    itemsDetails.forEach((item) => {
      message += `- ${item.name} x${item.quantity} = ${formatCurrency(item.total)}`
      if (item.notes) message += ` (${item.notes})`
      message += `\n`
    })
    message += `\nSubtotal: ${formatCurrency(subtotal)}`
    if (finalTipoPedido === "ENTREGA") {
      message += `\nTaxa de entrega: ${formatCurrency(deliveryFee)}`
    }
    message += `\nTotal: ${formatCurrency(total)}`
    message += `\n\nForma de pagamento: ${payment_method_display || "Não definida"}`
    message += `\nTipo: ${finalTipoPedido}`

    console.log("[v0] Pedido criado com sucesso:", order.id)

    const response = {
      success: true,
      order: {
        id: order.id,
        order_number: order.order_number,
        items: itemsDetails,
        subtotal,
        delivery_fee: deliveryFee,
        total,
        status: order.status,
        tipo_pedido: finalTipoPedido,
        payment_method: payment_method_display,
      },
      customer: {
        id: customer.id,
        name: customer.name,
      },
      message,
    }

    await logApiCall({
      route: "/api/ai/orders",
      method: "POST",
      status_code: statusCode,
      duration_ms: Date.now() - startedAt,
      request_body: body,
      response_body: response,
      restaurant_id: restaurant.id,
      customer_id: customer.id,
      order_id: order.id,
      metadata: {
        payment_method_id,
        payment_method_name: payment_method_display,
        tipo_pedido: finalTipoPedido,
        delivery_fee: deliveryFee,
        subtotal,
        total,
        items_count: orderItems.length,
      },
    })

    return NextResponse.json(response)
  } catch (error) {
    statusCode = 500
    console.error("[v0] Error creating AI order:", error)
    await logApiCall({
      route: "/api/ai/orders",
      method: "POST",
      status_code: statusCode,
      duration_ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      {
        error: "Failed to create order",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: statusCode },
    )
  }
}
