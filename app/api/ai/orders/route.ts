import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createOrderWithItems, getNextOrderNumber } from "@/src/services/ordersService"
import { sendOrderPdfToWhatsApp } from "@/src/services/whatsappService"
import { logApiCall } from "@/src/services/apiLogService"

function normalizeForSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
}

function pickBestPaymentMethodByName(
  inputName: string,
  methods: Array<{ id: string; name: string }>,
): { id: string; name: string } | null {
  const input = normalizeForSearch(inputName)
  if (!input) return null

  let best: { method: { id: string; name: string }; score: number; diff: number } | null = null

  for (const method of methods) {
    const candidate = normalizeForSearch(method.name)
    if (!candidate) continue

    let score = 0
    if (candidate === input) score = 3
    else if (candidate.startsWith(input) || input.startsWith(candidate)) score = 2
    else if (candidate.includes(input) || input.includes(candidate)) score = 1

    if (score === 0) continue

    const diff = Math.abs(candidate.length - input.length)
    if (!best || score > best.score || (score === best.score && diff < best.diff)) {
      best = { method, score, diff }
    }
  }

  return best?.method ?? null
}

type ParsedAddon = { addon_id: string; quantity: number }

function parseItensPedido(itensPedido: string): Array<{
  product_id: string
  quantity: number
  notes: string | null
  addons: ParsedAddon[]
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
      const addonsPart = parts[3]?.trim() || ""

      // addons no formato ad1|qtd,ad2|qtd; qtd opcional (default 1)
      const addons: ParsedAddon[] = addonsPart
        ? addonsPart
            .split(",")
            .map((adStr) => {
              const [addonIdRaw, qtyRaw] = adStr.split("|")
              const addon_id = (addonIdRaw || "").trim()
              const qty = Number.parseInt((qtyRaw || "1").trim(), 10)
              return addon_id
                ? {
                    addon_id,
                    quantity: Number.isNaN(qty) || qty <= 0 ? 1 : qty,
                  }
                : null
            })
            .filter((a): a is ParsedAddon => Boolean(a && a.addon_id))
        : []

      // Se notes for "null" ou vazio, usar null
      const finalNotes = notes && notes.toLowerCase() !== "null" ? notes : null

      return {
        product_id,
        quantity: isNaN(quantity) ? 1 : quantity,
        notes: finalNotes,
        addons,
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

let parsedItems: Array<{ product_id: string; quantity: number; notes: string | null; addons?: ParsedAddon[] }> = []

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
        addons: Array.isArray(item.addons)
          ? item.addons
              .map((ad: any) => ({
                addon_id: ad.addon_id,
                quantity: ad.quantity && ad.quantity > 0 ? ad.quantity : 1,
              }))
              .filter((ad) => ad.addon_id)
          : [],
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

    const { data: paymentMethods } = await supabase
      .from("payment_methods")
      .select("id, name")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("name", { ascending: true })

    const paymentMethod = pickBestPaymentMethodByName(String(payment_method_name), paymentMethods || [])

    if (!paymentMethod) {
      statusCode = 400
      const availablePaymentMethods = (paymentMethods || []).map((m) => m.name)
      await logApiCall({
        route: "/api/ai/orders",
        method: "POST",
        status_code: statusCode,
        duration_ms: Date.now() - startedAt,
        request_body: body,
        error: `Payment method not found: ${payment_method_name}`,
        restaurant_id: restaurant.id,
        customer_id: customer.id,
        metadata: {
          available_payment_methods: availablePaymentMethods,
        },
      })
      return NextResponse.json(
        {
          error: `Payment method not found: ${payment_method_name}`,
          available_payment_methods: availablePaymentMethods,
        },
        { status: statusCode },
      )
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
      addons?: Array<{ name: string; quantity: number; price: number }>
    }> = []

    // Fetch products with allowed addons
    const productIds = parsedItems.map((i) => i.product_id)
    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select(
        `
        id,
        name,
        category,
        price,
        requires_kitchen,
        product_addons:product_addons(
          addon:addons(id, name, price, is_active)
        )
      `,
      )
      .in("id", productIds)

    if (productsError) throw productsError

    // Preload addons by category as fallback when product_addons not set
    const categoriesSet = new Set<string>()
    productsData?.forEach((p: any) => {
      if (p.category) categoriesSet.add(p.category)
    })
    let addonsByCategory: Record<string, any[]> = {}
    if (categoriesSet.size > 0) {
      const { data: addonsData, error: addonsError } = await supabase
        .from("addons")
        .select(
          `
          id,
          name,
          price,
          is_active,
          category,
          addon_categories:addon_categories(category)
        `,
        )
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true)

      if (addonsError) throw addonsError
      addonsByCategory = (addonsData || []).reduce((acc: Record<string, any[]>, ad: any) => {
        const catList =
          (ad.addon_categories || []).map((c: any) => c?.category).filter(Boolean) ||
          (ad.category ? [ad.category] : [])
        const hasMatch = catList.some((cat: string) => categoriesSet.has(cat))
        if (!hasMatch) return acc
        catList.forEach((cat: string) => {
          acc[cat] = acc[cat] || []
          acc[cat].push({
            ...ad,
            categories: catList,
          })
        })
        return acc
      }, {})
    }

    const productMap = new Map((productsData || []).map((p: any) => [p.id, p]))
    const requiresKitchen = (productsData || []).some((p: any) => Boolean(p.requires_kitchen))

    for (const item of parsedItems) {
      const product = productMap.get(item.product_id)
      if (!product) {
        return NextResponse.json({ error: `Produto não encontrado: ${item.product_id}` }, { status: 400 })
      }

      let allowedAddons =
        product.product_addons
          ?.map((pa: any) => pa.addon)
          ?.filter((a: any) => a && a.is_active) || []
      // Fallback: se não houver vínculo explícito, usa addons ativos da mesma categoria
      if (!allowedAddons.length && product.category && addonsByCategory[product.category]) {
        allowedAddons = addonsByCategory[product.category]
      }

      const addonSelections =
        item.addons
          ?.map((sel) => {
            const found = allowedAddons.find((a: any) => a.id === sel.addon_id)
            if (!found) return null
            return {
              addon_id: sel.addon_id,
              name: found.name,
              price: Number(found.price) || 0,
              quantity: sel.quantity && sel.quantity > 0 ? sel.quantity : 1,
            }
          })
          .filter((a): a is { addon_id: string; name: string; price: number; quantity: number } => Boolean(a)) || []

      // If there were addon_ids sent but none matched, return error
      if (item.addons && item.addons.length > 0 && addonSelections.length !== item.addons.length) {
        return NextResponse.json(
          { error: `Adicionais inválidos para o produto ${product.name}` },
          { status: 400 },
        )
      }

      const addonsTotal = addonSelections.reduce((acc, ad) => acc + ad.price * ad.quantity, 0)
      const baseTotal = product.price * item.quantity
      const itemTotal = baseTotal + addonsTotal
      subtotal += itemTotal

      orderItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: product.price,
        total_price: itemTotal,
        notes: item.notes,
        addons: addonSelections.map((ad) => ({ addon_id: ad.addon_id, quantity: ad.quantity })),
      })

      itemsDetails.push({
        name: product.name,
        quantity: item.quantity,
        unit_price: product.price,
        total: itemTotal,
        notes: item.notes,
        addons: addonSelections.map((ad) => ({ name: ad.name, quantity: ad.quantity, price: ad.price })),
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
      status: (requiresKitchen ? "NOVO" : "FINALIZADO") as const,
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
      if (item.addons && item.addons.length > 0) {
        item.addons.forEach((ad) => {
          message += `\n  * ${ad.name} x${ad.quantity} = ${formatCurrency(ad.price * ad.quantity)}`
        })
      }
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

    const customerPhone = customer?.phone ? String(customer.phone).replace(/\D/g, "") : ""
    if (customerPhone) {
      try {
        await sendOrderPdfToWhatsApp({
          orderId: order.id,
          number: customerPhone,
          delayMs: 6000,
        })
      } catch (err) {
        console.error("[v0] Error sending order PDF via WhatsApp:", err)
      }
    }

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
