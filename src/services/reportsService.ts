import { createClient } from "@/lib/supabase/server"

export interface ReportFilters {
  date_from?: string
  date_to?: string
}

export interface SalesMetrics {
  total_revenue: number // Total sem taxa de entrega
  total_delivery_fees: number // Total das taxas de entrega (para motoboy)
  total_orders: number
  average_ticket: number
}

export interface TopProduct {
  product_id: string
  product_name: string
  total_quantity: number
  total_revenue: number
}

export interface DailySales {
  date: string
  total_orders: number
  total_revenue: number
  total_delivery_fees: number
}

export interface ChannelDistribution {
  channel: string
  total_orders: number
  total_revenue: number
}

export interface ServiceTypeDistribution {
  service_type: string
  total_orders: number
  total_revenue: number
}

export async function getSalesMetrics(restaurantId: string, filters?: ReportFilters): Promise<SalesMetrics> {
  const supabase = await createClient()

  let query = supabase
    .from("orders")
    .select("total, delivery_fee")
    .eq("restaurant_id", restaurantId)
    .eq("status", "ENTREGUE") // Só pedidos concluídos

  if (filters?.date_from) {
    query = query.gte("created_at", filters.date_from)
  }
  if (filters?.date_to) {
    query = query.lte("created_at", filters.date_to)
  }

  const { data, error } = await query

  if (error) throw error

  const orders = data || []
  const total_orders = orders.length
  const total_delivery_fees = orders.reduce((sum, order) => sum + (Number(order.delivery_fee) || 0), 0)
  const total_revenue = orders.reduce(
    (sum, order) => sum + (Number(order.total) || 0) - (Number(order.delivery_fee) || 0),
    0,
  )
  const average_ticket = total_orders > 0 ? total_revenue / total_orders : 0

  return {
    total_revenue,
    total_delivery_fees,
    total_orders,
    average_ticket,
  }
}

export async function getTopProducts(restaurantId: string, limit = 3, filters?: ReportFilters): Promise<TopProduct[]> {
  const supabase = await createClient()

  let ordersQuery = supabase.from("orders").select("id").eq("restaurant_id", restaurantId).eq("status", "ENTREGUE")

  if (filters?.date_from) {
    ordersQuery = ordersQuery.gte("created_at", filters.date_from)
  }
  if (filters?.date_to) {
    ordersQuery = ordersQuery.lte("created_at", filters.date_to)
  }

  const { data: orders, error: ordersError } = await ordersQuery

  if (ordersError) throw ordersError
  if (!orders || orders.length === 0) return []

  const orderIds = orders.map((o) => o.id)

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("product_id, quantity, total_price, product:products(name)")
    .in("order_id", orderIds)

  if (itemsError) throw itemsError
  if (!items) return []

  // Agrupar por produto
  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>()

  items.forEach((item: any) => {
    const productId = item.product_id
    const productName = item.product?.name || "Produto desconhecido"
    const quantity = Number(item.quantity) || 0
    const revenue = Number(item.total_price) || 0

    if (productMap.has(productId)) {
      const existing = productMap.get(productId)!
      existing.quantity += quantity
      existing.revenue += revenue
    } else {
      productMap.set(productId, { name: productName, quantity, revenue })
    }
  })

  // Converter para array e ordenar
  const topProducts = Array.from(productMap.entries())
    .map(([product_id, data]) => ({
      product_id,
      product_name: data.name,
      total_quantity: data.quantity,
      total_revenue: data.revenue,
    }))
    .sort((a, b) => b.total_quantity - a.total_quantity)
    .slice(0, limit)

  return topProducts
}

export async function getDailySales(restaurantId: string, filters?: ReportFilters): Promise<DailySales[]> {
  const supabase = await createClient()

  let query = supabase
    .from("orders")
    .select("created_at, total, delivery_fee")
    .eq("restaurant_id", restaurantId)
    .eq("status", "ENTREGUE")
    .order("created_at", { ascending: true })

  if (filters?.date_from) {
    query = query.gte("created_at", filters.date_from)
  }
  if (filters?.date_to) {
    query = query.lte("created_at", filters.date_to)
  }

  const { data, error } = await query

  if (error) throw error
  if (!data) return []

  // Agrupar por dia
  const dailyMap = new Map<string, { orders: number; revenue: number; delivery_fees: number }>()

  data.forEach((order: any) => {
    const date = new Date(order.created_at).toISOString().split("T")[0]
    const revenue = (Number(order.total) || 0) - (Number(order.delivery_fee) || 0)
    const delivery_fee = Number(order.delivery_fee) || 0

    if (dailyMap.has(date)) {
      const existing = dailyMap.get(date)!
      existing.orders += 1
      existing.revenue += revenue
      existing.delivery_fees += delivery_fee
    } else {
      dailyMap.set(date, { orders: 1, revenue, delivery_fees: delivery_fee })
    }
  })

  // Converter para array
  return Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      total_orders: data.orders,
      total_revenue: data.revenue,
      total_delivery_fees: data.delivery_fees,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function getChannelDistribution(
  restaurantId: string,
  filters?: ReportFilters,
): Promise<ChannelDistribution[]> {
  const supabase = await createClient()

  let query = supabase
    .from("orders")
    .select("channel, total, delivery_fee")
    .eq("restaurant_id", restaurantId)
    .eq("status", "ENTREGUE")

  if (filters?.date_from) {
    query = query.gte("created_at", filters.date_from)
  }
  if (filters?.date_to) {
    query = query.lte("created_at", filters.date_to)
  }

  const { data, error } = await query

  if (error) throw error
  if (!data) return []

  // Agrupar por canal
  const channelMap = new Map<string, { orders: number; revenue: number }>()

  data.forEach((order: any) => {
    const channel = order.channel || "Não informado"
    const revenue = (Number(order.total) || 0) - (Number(order.delivery_fee) || 0)

    if (channelMap.has(channel)) {
      const existing = channelMap.get(channel)!
      existing.orders += 1
      existing.revenue += revenue
    } else {
      channelMap.set(channel, { orders: 1, revenue })
    }
  })

  return Array.from(channelMap.entries()).map(([channel, data]) => ({
    channel,
    total_orders: data.orders,
    total_revenue: data.revenue,
  }))
}

export async function getServiceTypeDistribution(
  restaurantId: string,
  filters?: ReportFilters,
): Promise<ServiceTypeDistribution[]> {
  const supabase = await createClient()

  let query = supabase
    .from("orders")
    .select("delivery_mode, total, delivery_fee")
    .eq("restaurant_id", restaurantId)
    .eq("status", "ENTREGUE")

  if (filters?.date_from) {
    query = query.gte("created_at", filters.date_from)
  }
  if (filters?.date_to) {
    query = query.lte("created_at", filters.date_to)
  }

  const { data, error } = await query

  if (error) throw error
  if (!data) return []

  // Agrupar por tipo de serviço
  const serviceMap = new Map<string, { orders: number; revenue: number }>()

  data.forEach((order: any) => {
    const serviceType = order.delivery_mode || "Não informado"
    const revenue = (Number(order.total) || 0) - (Number(order.delivery_fee) || 0)

    if (serviceMap.has(serviceType)) {
      const existing = serviceMap.get(serviceType)!
      existing.orders += 1
      existing.revenue += revenue
    } else {
      serviceMap.set(serviceType, { orders: 1, revenue })
    }
  })

  return Array.from(serviceMap.entries()).map(([service_type, data]) => ({
    service_type,
    total_orders: data.orders,
    total_revenue: data.revenue,
  }))
}
