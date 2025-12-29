import { createClient } from "@/lib/supabase/server"
import type {
  Order,
  OrderItem,
  CreateOrderInput,
  CreateOrderItemInput,
  OrderStatus,
  PaymentStatus,
} from "@/src/domain/types"

/**
 * Service layer for Order operations
 */

export interface OrderFilters {
  channel?: "BALCAO" | "DELIVERY"
  tipo_pedido?: "BALCAO" | "RETIRADA" | "ENTREGA" | "COMANDA"
  status?: OrderStatus
  payment_status?: PaymentStatus
  customer_id?: string
  date_from?: string
  date_to?: string
}

export interface OrderWithDetails extends Order {
  customer?: {
    id: string
    name: string
    phone: string | null
  } | null
  items?: Array<{
    id: string
    product_id: string
    product_name: string
    quantity: number
    unit_price: number
    total_price: number
    notes: string | null
    addons?: Array<{
      id: string
      addon_id: string
      name: string
      price: number
      quantity: number
    }>
  }>
  payment_method?: {
    id: string
    name: string
  } | null
  comanda?: {
    id: string
    numero: number
    mesa: string
  } | null
}

export async function listOrders(restaurantId: string, filters?: OrderFilters): Promise<Order[]> {
  const supabase = await createClient()
  let query = supabase.from("orders").select("*").eq("restaurant_id", restaurantId)

  if (filters?.tipo_pedido) {
    query = query.eq("tipo_pedido", filters.tipo_pedido)
  } else if (filters?.channel) {
    query = query.eq("channel", filters.channel)
  }
  if (filters?.status) {
    query = query.eq("status", filters.status)
  }
  if (filters?.payment_status) {
    query = query.eq("payment_status", filters.payment_status)
  }
  if (filters?.customer_id) {
    query = query.eq("customer_id", filters.customer_id)
  }
  if (filters?.date_from) {
    query = query.gte("created_at", filters.date_from)
  }
  if (filters?.date_to) {
    query = query.lte("created_at", filters.date_to)
  }

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) throw error
  return data as Order[]
}

export async function listOrdersForKanban(
  restaurantId: string,
  filters?: Omit<OrderFilters, "date_from" | "date_to"> & { period?: "30min" | "today" | "all" },
): Promise<OrderWithDetails[]> {
  const supabase = await createClient()

  console.log("[v0] listOrdersForKanban called with:", { restaurantId, filters })

  // Calculate date filter based on period
  let date_from: string | undefined
  if (filters?.period === "30min") {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)
    date_from = thirtyMinAgo.toISOString()
  } else if (filters?.period === "today") {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    date_from = today.toISOString()
  }

  console.log("[v0] Date filter:", date_from)

  let query = supabase
    .from("orders")
    .select(
      `
      *,
      customer:customers(id, name, phone),
      payment_method:payment_methods(id, name)
    `,
    )
    .eq("restaurant_id", restaurantId)

  if (filters?.tipo_pedido) {
    query = query.eq("tipo_pedido", filters.tipo_pedido)
  } else if (filters?.channel) {
    query = query.eq("channel", filters.channel)
  }
  if (filters?.status) {
    query = query.eq("status", filters.status)
  }
  if (date_from) {
    query = query.gte("created_at", date_from)
  }

  const { data: ordersData, error: ordersError } = await query.order("created_at", { ascending: false })

  console.log("[v0] Supabase query returned:", ordersData?.length || 0, "orders")
  if (ordersError) {
    console.log("[v0] Supabase query error:", ordersError)
  }

  if (ordersError) throw ordersError

  // Fetch items for each order and comanda data if exists
  const ordersWithItems = await Promise.all(
    (ordersData || []).map(async (order) => {
      const { data: itemsData } = await supabase
        .from("order_items")
        .select(
          `
          id,
          product_id,
          quantity,
          unit_price,
          total_price,
          notes,
          product:products(name),
          addons:order_item_addons(id, addon_id, name, price, quantity)
        `,
        )
        .eq("order_id", order.id)

      const items =
        itemsData?.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product?.name || "Produto desconhecido",
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          notes: item.notes,
          addons:
            item.addons?.map((ad: any) => ({
              id: ad.id,
              addon_id: ad.addon_id,
              name: ad.name,
              price: ad.price,
              quantity: ad.quantity,
            })) || [],
        })) || []

      let comanda = null
      if (order.comanda_id) {
        const { data: comandaData } = await supabase
          .from("comandas")
          .select("id, numero, mesa")
          .eq("id", order.comanda_id)
          .single()

        if (comandaData) {
          comanda = comandaData
        }
      }

      return {
        ...order,
        items,
        comanda,
      } as OrderWithDetails
    }),
  )

  console.log("[v0] Returning", ordersWithItems.length, "orders with items")
  if (ordersWithItems.length > 0) {
    console.log("[v0] Sample order:", ordersWithItems[0])
  }

  return ordersWithItems
}

export async function getOrderById(id: string): Promise<Order | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("orders").select("*").eq("id", id).single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }
  return data as Order
}

export async function getNextOrderNumber(restaurantId: string): Promise<number> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("orders")
    .select("order_number")
    .eq("restaurant_id", restaurantId)
    .order("order_number", { ascending: false })
    .limit(1)

  if (error) throw error
  if (!data || data.length === 0) return 1
  return (data[0] as { order_number: number }).order_number + 1
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("orders").insert(input).select().single()

  if (error) throw error
  return data as Order
}

export async function updateOrder(
  id: string,
  updates: Partial<Omit<CreateOrderInput, "restaurant_id" | "order_number" | "created_at">>,
): Promise<Order> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("orders").update(updates).eq("id", id).select().single()

  if (error) throw error
  return data as Order
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  return updateOrder(id, { status })
}

export async function updateOrderPaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<Order> {
  return updateOrder(id, { payment_status: paymentStatus })
}

export async function markOrderKitchenPrinted(id: string): Promise<Order> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("orders")
    .update({ kitchen_printed_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data as Order
}

export async function markOrderCustomerPrinted(id: string): Promise<Order> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("orders")
    .update({ customer_printed_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data as Order
}

export async function deleteOrder(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from("orders").delete().eq("id", id)

  if (error) throw error
}

// Order Items operations

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("order_items").select("*").eq("order_id", orderId)

  if (error) throw error
  return data as OrderItem[]
}

export async function createOrderItem(input: CreateOrderItemInput): Promise<OrderItem> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("order_items").insert(input).select().single()

  if (error) throw error
  return data as OrderItem
}

export async function deleteOrderItem(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from("order_items").delete().eq("id", id)

  if (error) throw error
}

export async function createOrderWithItems(
  orderInput: CreateOrderInput,
  itemsInput: CreateOrderItemInput[],
): Promise<{ order: Order; items: OrderItem[] }> {
  const supabase = await createClient()

  // Create the order first
  const { data: orderData, error: orderError } = await supabase.from("orders").insert(orderInput).select().single()

  if (orderError) throw orderError

  const order = orderData as Order

  // Create all order items (strip addons before insert)
  const itemsWithOrderId = itemsInput.map(({ addons: _addons, ...item }) => ({
    ...item,
    order_id: order.id,
  }))

  const { data: itemsData, error: itemsError } = await supabase.from("order_items").insert(itemsWithOrderId).select()

  if (itemsError) {
    // Rollback: delete the order if items creation fails
    await supabase.from("orders").delete().eq("id", order.id)
    throw itemsError
  }

  const insertedItems = itemsData as OrderItem[]

  // Addons handling: collect all addon selections
  const addonSelections: Array<{ addon_id: string; quantity: number; order_item_index: number }> = []
  itemsInput.forEach((item, index) => {
    if (item.addons && item.addons.length > 0) {
      item.addons.forEach((a) => {
        if (a.addon_id) {
          addonSelections.push({
            addon_id: a.addon_id,
            quantity: a.quantity && a.quantity > 0 ? a.quantity : 1,
            order_item_index: index,
          })
        }
      })
    }
  })

  let addonsTotalByItem: Record<number, number> = {}

  if (addonSelections.length > 0) {
    // Fetch addon details
    const { data: addonRows, error: addonError } = await supabase
      .from("addons")
      .select("id, name, price, is_active")
      .in(
        "id",
        Array.from(new Set(addonSelections.map((a) => a.addon_id))),
      )

    if (addonError) throw addonError

    const addonMap = new Map<string, { name: string; price: number; is_active: boolean }>()
    ;(addonRows || []).forEach((row: any) => {
      addonMap.set(row.id, { name: row.name, price: Number(row.price) || 0, is_active: row.is_active })
    })

    const orderItemAddonsToInsert: Array<{
      order_item_id: string
      addon_id: string
      name: string
      price: number
      quantity: number
    }> = []

    addonSelections.forEach((sel) => {
      const addon = addonMap.get(sel.addon_id)
      if (!addon) return
      const itemRow = insertedItems[sel.order_item_index]
      if (!itemRow) return

      const price = addon.price
      const qty = sel.quantity
      orderItemAddonsToInsert.push({
        order_item_id: itemRow.id,
        addon_id: sel.addon_id,
        name: addon.name,
        price,
        quantity: qty,
      })

      addonsTotalByItem[sel.order_item_index] = (addonsTotalByItem[sel.order_item_index] || 0) + price * qty
    })

    if (orderItemAddonsToInsert.length > 0) {
      const { error: oiAddonError } = await supabase.from("order_item_addons").insert(orderItemAddonsToInsert)
      if (oiAddonError) throw oiAddonError
    }
  }

  // Recalculate item totals to include addons and update order subtotal/total
  const itemsWithTotals = insertedItems.map((item, index) => {
    const addonsTotal = addonsTotalByItem[index] || 0
    const baseTotal = (item.unit_price || 0) * (item.quantity || 0)
    const total_price = baseTotal + addonsTotal
    return { ...item, total_price }
  })

  // Persist updated item totals
  if (addonsTotalByItem && Object.keys(addonsTotalByItem).length > 0) {
    await Promise.all(
      itemsWithTotals.map((item) =>
        supabase
          .from("order_items")
          .update({ total_price: item.total_price })
          .eq("id", item.id),
      ),
    )
  }

  const subtotal = itemsWithTotals.reduce((acc, item) => acc + (Number(item.total_price) || 0), 0)
  const deliveryFee = orderInput.delivery_fee || 0
  const total = subtotal + deliveryFee

  // Update order totals
  const { data: updatedOrderData, error: updateOrderError } = await supabase
    .from("orders")
    .update({ subtotal, total })
    .eq("id", order.id)
    .select()
    .single()

  if (updateOrderError) throw updateOrderError

  return {
    order: updatedOrderData as Order,
    items: itemsWithTotals as OrderItem[],
  }
}

export interface OrderForPrint extends OrderWithDetails {
  restaurant?: {
    id: string
    name: string
    address: string
    cep_origem: string
  }
}

export async function getOrderForPrint(orderId: string): Promise<OrderForPrint | null> {
  const supabase = await createClient()

  // Fetch order with related data (manual fetch for comanda to avoid FK requirement)
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select(
      `
      *,
      customer:customers(id, name, phone, street, number, neighborhood, city, cep),
      payment_method:payment_methods(id, name),
      restaurant:restaurants(id, name, address, cep_origem)
    `,
    )
    .eq("id", orderId)
    .single()

  if (orderError) {
    if (orderError.code === "PGRST116") return null
    throw orderError
  }

  // Fetch order items with product details
  const { data: itemsData, error: itemsError } = await supabase
    .from("order_items")
    .select(
      `
      id,
      product_id,
      quantity,
      unit_price,
      total_price,
      notes,
      product:products(id, name, type),
      addons:order_item_addons(id, addon_id, name, price, quantity)
    `,
    )
    .eq("order_id", orderId)

  if (itemsError) throw itemsError

  let comanda = null
  if ((orderData as any)?.comanda_id) {
    const { data: comandaData, error: comandaError } = await supabase
      .from("comandas")
      .select("id, numero, mesa")
      .eq("id", (orderData as any).comanda_id)
      .single()

    if (comandaError && comandaError.code !== "PGRST116") throw comandaError
    if (comandaData) comanda = comandaData
  }

  const items =
    itemsData?.map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product?.name || "Produto desconhecido",
      product_type: item.product?.type || "UNIT",
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      notes: item.notes,
      addons:
        item.addons?.map((ad: any) => ({
          id: ad.id,
          addon_id: ad.addon_id,
          name: ad.name,
          price: ad.price,
          quantity: ad.quantity,
        })) || [],
    })) || []

  return {
    ...orderData,
    comanda,
    items,
  } as OrderForPrint
}
