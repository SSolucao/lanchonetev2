import { createClient } from "@/lib/supabase/server"
import type { DeliveryRule, CreateDeliveryRuleInput } from "@/src/domain/types"

/**
 * Service layer for Delivery Rule operations
 */

export async function listDeliveryRules(restaurantId: string): Promise<DeliveryRule[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("delivery_rules")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("neighborhood") // Order by neighborhood first, then km

  if (error) throw error
  return data as DeliveryRule[]
}

export async function getDeliveryRuleById(id: string): Promise<DeliveryRule | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("delivery_rules").select("*").eq("id", id).single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }
  return data as DeliveryRule
}

export async function createDeliveryRule(input: CreateDeliveryRuleInput): Promise<DeliveryRule> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("delivery_rules").insert(input).select().single()

  if (error) throw error
  return data as DeliveryRule
}

export async function updateDeliveryRule(
  id: string,
  updates: Partial<Omit<CreateDeliveryRuleInput, "restaurant_id">>,
): Promise<DeliveryRule> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("delivery_rules").update(updates).eq("id", id).select().single()

  if (error) throw error
  return data as DeliveryRule
}

export async function deleteDeliveryRule(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from("delivery_rules").delete().eq("id", id)

  if (error) throw error
}

/**
 * Find the appropriate delivery fee based on neighborhood
 */
export async function findDeliveryFeeForNeighborhood(
  restaurantId: string,
  neighborhood: string,
): Promise<number | null> {
  const supabase = await createClient()

  const normalized = neighborhood.trim()
  if (!normalized) return null

  const baseQuery = supabase.from("delivery_rules").select("*").eq("restaurant_id", restaurantId)

  const { data: exactMatch, error: exactError } = await baseQuery
    .eq("neighborhood_normalized", normalized.toLowerCase())
    .limit(1)

  if (exactError) throw exactError
  if (exactMatch && exactMatch.length > 0) {
    return (exactMatch[0] as DeliveryRule).fee
  }

  const { data: aliasMatch, error: aliasError } = await baseQuery.contains("neighborhood_aliases", [normalized])

  if (aliasError) throw aliasError
  if (aliasMatch && aliasMatch.length > 0) {
    return (aliasMatch[0] as DeliveryRule).fee
  }

  const pattern = `%${normalized}%`
  const { data: partialMatch, error: partialError } = await baseQuery.ilike("neighborhood", pattern).limit(1)

  if (partialError) throw partialError
  if (!partialMatch || partialMatch.length === 0) return null

  return (partialMatch[0] as DeliveryRule).fee
}

/**
 * Find the appropriate delivery fee based on distance
 */
export async function findDeliveryFeeForDistance(restaurantId: string, distanceKm: number): Promise<number> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("delivery_rules")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .is("neighborhood", null) // Only get distance-based rules
    .lte("from_km", distanceKm)
    .gte("to_km", distanceKm)
    .single()

  if (error) {
    if (error.code === "PGRST116") return 0 // No rule found, return 0
    throw error
  }
  return (data as DeliveryRule).fee
}
