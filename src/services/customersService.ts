import { createClient } from "@/lib/supabase/server"
import type { Customer, CreateCustomerInput } from "@/src/domain/types"

/**
 * Service layer for Customer operations
 */

export interface CustomerFilters {
  search?: string // Search by name or phone
}

export async function listCustomers(restaurantId: string, filters?: CustomerFilters): Promise<Customer[]> {
  const supabase = await createClient()
  let query = supabase.from("customers").select("*").eq("restaurant_id", restaurantId).eq("active", true) // Filter only active customers

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`)
  }

  const { data, error } = await query.order("name")

  if (error) throw error
  return data as Customer[]
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("customers").select("*").eq("id", id).single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }
  return data as Customer
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("customers").insert(input).select().single()

  if (error) throw error
  return data as Customer
}

export async function updateCustomer(
  id: string,
  updates: Partial<Omit<CreateCustomerInput, "restaurant_id">>,
): Promise<Customer> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("customers").update(updates).eq("id", id).select().single()

  if (error) throw error
  return data as Customer
}

export async function deleteCustomer(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from("customers").update({ active: false }).eq("id", id)

  if (error) throw error
}

export async function searchCustomers(restaurantId: string, query: string): Promise<Customer[]> {
  if (!query || query.trim().length === 0) {
    return []
  }

  const supabase = await createClient()
  const searchTerm = query.trim()

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("active", true) // Filter only active customers in search
    .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
    .order("name")
    .limit(10)

  if (error) throw error
  return data as Customer[]
}

export async function getCustomerByPhone(restaurantId: string, phone: string): Promise<Customer | null> {
  const supabase = await createClient()
  const cleanPhone = phone.replace(/\D/g, "") // Remove non-digits

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("phone", cleanPhone)
    .eq("active", true) // Filter only active customers when searching by phone
    .single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }
  return data as Customer
}
