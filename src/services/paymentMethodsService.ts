import { createClient } from "@/lib/supabase/server"
import type { PaymentMethod, CreatePaymentMethodInput } from "@/src/domain/types"

/**
 * Service layer for Payment Method operations
 */

export async function listPaymentMethods(restaurantId: string, activeOnly = false): Promise<PaymentMethod[]> {
  const supabase = await createClient()
  let query = supabase.from("payment_methods").select("*").eq("restaurant_id", restaurantId)

  if (activeOnly) {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query.order("name")

  if (error) throw error
  return data as PaymentMethod[]
}

export async function getPaymentMethodById(id: string): Promise<PaymentMethod | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("payment_methods").select("*").eq("id", id).single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }
  return data as PaymentMethod
}

export async function createPaymentMethod(input: CreatePaymentMethodInput): Promise<PaymentMethod> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("payment_methods").insert(input).select().single()

  if (error) throw error
  return data as PaymentMethod
}

export async function updatePaymentMethod(
  id: string,
  updates: Partial<Omit<CreatePaymentMethodInput, "restaurant_id">>,
): Promise<PaymentMethod> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("payment_methods").update(updates).eq("id", id).select().single()

  if (error) throw error
  return data as PaymentMethod
}

export async function deletePaymentMethod(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from("payment_methods").delete().eq("id", id)

  if (error) throw error
}
