import { createClient } from "@/lib/supabase/server"

/**
 * Service layer for Comanda operations
 */

export interface Comanda {
  id: string
  restaurant_id: string
  numero: number
  mesa: string
  customer_id: string | null
  customer_name: string | null
  status: "ABERTA" | "FECHADA"
  total: number
  opened_at: string
  closed_at: string | null
  payment_method_id: string | null
  created_at: string
  updated_at: string
  customer?: {
    id: string
    name: string
    phone: string | null
  } | null
  orders?: Array<{
    id: string
    order_number: number
    total: number
    status: string
    created_at: string
    items?: Array<{
      product_name: string
      quantity: number
      unit_price: number
      notes?: string
    }>
  }>
}

export interface CreateComandaInput {
  restaurant_id: string
  mesa: string
  customer_name?: string | null
}

export interface FecharComandaInput {
  payment_method_id: string
}

export async function listComandas(restaurantId: string, status?: "ABERTA" | "FECHADA"): Promise<Comanda[]> {
  const supabase = await createClient()

  let query = supabase
    .from("comandas")
    .select(`
      *,
      customer:customers(id, name, phone)
    `)
    .eq("restaurant_id", restaurantId)

  if (status) {
    query = query.eq("status", status)
  }

  const { data, error } = await query.order("opened_at", { ascending: false })

  if (error) throw error

  const comandasWithOrders = await Promise.all(
    (data || []).map(async (comanda) => {
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, order_number, total, status, created_at")
        .eq("comanda_id", comanda.id)
        .order("created_at", { ascending: false })

      if (ordersError) throw ordersError

      // Buscar items de cada pedido
      const ordersWithItems = await Promise.all(
        (orders || []).map(async (order) => {
          const { data: items } = await supabase
            .from("order_items")
            .select(`
              quantity,
              unit_price,
              notes,
              product:products(name)
            `)
            .eq("order_id", order.id)

          return {
            ...order,
            items:
              items?.map((item: any) => ({
                product_name: item.product?.name || "Produto",
                quantity: item.quantity,
                unit_price: item.unit_price,
                notes: item.notes,
              })) || [],
          }
        }),
      )

      return {
        ...comanda,
        orders: ordersWithItems,
      }
    }),
  )

  return comandasWithOrders as Comanda[]
}

export async function getComandaById(id: string): Promise<Comanda | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("comandas")
    .select(`
      *,
      customer:customers(id, name, phone)
    `)
    .eq("id", id)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, order_number, total, status, created_at")
    .eq("comanda_id", id)
    .order("created_at", { ascending: false })

  if (ordersError) throw ordersError

  const ordersWithItems = await Promise.all(
    (orders || []).map(async (order) => {
      const { data: items } = await supabase
        .from("order_items")
        .select(`
          quantity,
          unit_price,
          notes,
          product:products(name)
        `)
        .eq("order_id", order.id)

      return {
        ...order,
        items:
          items?.map((item: any) => ({
            product_name: item.product?.name || "Produto",
            quantity: item.quantity,
            unit_price: item.unit_price,
            notes: item.notes,
          })) || [],
      }
    }),
  )

  return {
    ...data,
    orders: ordersWithItems,
  } as Comanda
}

export async function createComanda(input: CreateComandaInput): Promise<Comanda> {
  const supabase = await createClient()

  // Get next numero using database function
  const { data: numeroData, error: numeroError } = await supabase.rpc("get_next_comanda_numero", {
    p_restaurant_id: input.restaurant_id,
  })

  if (numeroError) throw numeroError

  const newComanda = {
    restaurant_id: input.restaurant_id,
    mesa: input.mesa,
    customer_name: input.customer_name || null,
    customer_id: null,
    numero: numeroData,
    status: "ABERTA" as const,
    total: 0,
  }

  const { data, error } = await supabase.from("comandas").insert(newComanda).select("*").single()

  if (error) throw error

  return {
    ...data,
    orders: [],
  } as Comanda
}

export async function fecharComanda(id: string, input: FecharComandaInput): Promise<Comanda> {
  const supabase = await createClient()

  const updates = {
    status: "FECHADA" as const,
    closed_at: new Date().toISOString(),
    payment_method_id: input.payment_method_id,
  }

  const { data, error } = await supabase
    .from("comandas")
    .update(updates)
    .eq("id", id)
    .select(`
      *,
      customer:customers(id, name, phone)
    `)
    .single()

  if (error) throw error

  // Also update all orders in this comanda to PAGO
  await supabase.from("orders").update({ payment_status: "PAGO" }).eq("comanda_id", id)

  return data as Comanda
}

export async function deleteComanda(id: string): Promise<void> {
  const supabase = await createClient()

  // Check if comanda has orders
  const { data: orders } = await supabase.from("orders").select("id").eq("comanda_id", id).limit(1)

  if (orders && orders.length > 0) {
    throw new Error("Não é possível deletar comanda com pedidos vinculados")
  }

  const { error } = await supabase.from("comandas").delete().eq("id", id)

  if (error) throw error
}
