import { createClient } from "@/lib/supabase/server"
import type { DeliveryRule, CreateDeliveryRuleInput } from "@/src/domain/types"

export interface DeliveryRuleSimilarityResult {
  id: string
  neighborhood: string
  fee: number
  similarity: number
}

const NEIGHBORHOOD_STOP_WORDS = new Set([
  "bairro",
  "conjunto",
  "jd",
  "jardim",
  "loteamento",
  "parque",
  "residencial",
  "res",
  "setor",
  "vila",
])

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

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function tokenizeMeaningful(text: string): string[] {
  return text
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !NEIGHBORHOOD_STOP_WORDS.has(token))
}

function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0

  const gramsA = new Map<string, number>()
  for (let i = 0; i < a.length - 1; i += 1) {
    const gram = a.slice(i, i + 2)
    gramsA.set(gram, (gramsA.get(gram) ?? 0) + 1)
  }

  let intersection = 0
  for (let i = 0; i < b.length - 1; i += 1) {
    const gram = b.slice(i, i + 2)
    const count = gramsA.get(gram)
    if (count && count > 0) {
      intersection += 1
      gramsA.set(gram, count - 1)
    }
  }

  return (2 * intersection) / ((a.length - 1) + (b.length - 1))
}

function tokenOverlap(a: string, b: string): number {
  const tokensA = new Set(a.split(" ").filter(Boolean))
  const tokensB = new Set(b.split(" ").filter(Boolean))

  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let shared = 0
  for (const token of tokensA) {
    if (tokensB.has(token)) shared += 1
  }

  return shared / Math.max(tokensA.size, tokensB.size)
}

function calculateSimilarity(query: string, candidate: string): number {
  if (!query || !candidate) return 0
  if (query === candidate) return 1

  const queryTokens = tokenizeMeaningful(query)
  const candidateTokens = tokenizeMeaningful(candidate)

  const dice = diceCoefficient(query, candidate)
  const overlap = tokenOverlap(query, candidate)

  let meaningfulOverlap = 0
  if (queryTokens.length > 0 && candidateTokens.length > 0) {
    const candidateSet = new Set(candidateTokens)
    const shared = queryTokens.filter((token) => candidateSet.has(token)).length
    meaningfulOverlap = shared / queryTokens.length
  }

  if (queryTokens.length > 0 && meaningfulOverlap === 0 && dice < 0.6) {
    return 0
  }

  const containsBoost = candidate.includes(query) || query.includes(candidate) ? 0.1 : 0

  return Math.min(1, dice * 0.35 + overlap * 0.25 + meaningfulOverlap * 0.3 + containsBoost)
}

export async function searchDeliveryRulesByNeighborhood(
  restaurantId: string,
  query: string,
  limit = 10,
  minSimilarity = 0.3,
): Promise<DeliveryRuleSimilarityResult[]> {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("delivery_rules")
    .select("id, neighborhood, fee")
    .eq("restaurant_id", restaurantId)
    .not("neighborhood", "is", null)
    .neq("neighborhood", "")

  if (error) throw error

  const results =
    (data || [])
      .map((rule) => {
        const neighborhood = String(rule.neighborhood || "").trim()
        const similarity = calculateSimilarity(normalizedQuery, normalizeText(neighborhood))

        return {
          id: String(rule.id),
          neighborhood,
          fee: Number(rule.fee),
          similarity,
        }
      })
      .filter((rule) => rule.neighborhood && rule.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity || a.neighborhood.localeCompare(b.neighborhood))
      .slice(0, Math.max(1, Math.min(50, limit))) || []

  return results
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
