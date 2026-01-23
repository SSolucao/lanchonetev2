import { createClient } from "@/lib/supabase/server"
import { findDeliveryFeeForNeighborhood } from "./deliveryRulesService"

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "AIzaSyBNjfiItLhohHgV6EmMOxykuYBPxvJNJLU"

interface DistanceResult {
  success: boolean
  distance_km: number
  duration_minutes?: number
  error?: string
}

interface DeliveryFeeResult {
  success: boolean
  distance_km: number
  fee: number
  rule_applied?: string
  error?: string
}

/**
 * Calcula a distância entre dois endereços usando Google Distance Matrix API
 */
export async function calculateDistance(originAddress: string, destinationAddress: string): Promise<DistanceResult> {
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json")
    url.searchParams.set("origins", originAddress)
    url.searchParams.set("destinations", destinationAddress)
    url.searchParams.set("mode", "driving")
    url.searchParams.set("language", "pt-BR")
    url.searchParams.set("key", GOOGLE_MAPS_API_KEY)

    console.log("[v0] Google Distance Matrix request:", {
      origin: originAddress,
      destination: destinationAddress,
    })

    const response = await fetch(url.toString())
    const data = await response.json()

    console.log("[v0] Google Distance Matrix response status:", data.status)

    if (data.status !== "OK") {
      return {
        success: false,
        distance_km: 0,
        error: `Google API error: ${data.status}`,
      }
    }

    const element = data.rows?.[0]?.elements?.[0]

    if (!element || element.status !== "OK") {
      return {
        success: false,
        distance_km: 0,
        error: `Route not found: ${element?.status || "Unknown"}`,
      }
    }

    const distanceMeters = element.distance.value
    const distanceKm = distanceMeters / 1000
    const durationMinutes = Math.round(element.duration.value / 60)

    console.log("[v0] Distance calculated:", {
      meters: distanceMeters,
      km: distanceKm,
      minutes: durationMinutes,
    })

    return {
      success: true,
      distance_km: Math.round(distanceKm * 100) / 100, // 2 decimal places
      duration_minutes: durationMinutes,
    }
  } catch (error) {
    console.error("[v0] Error calculating distance:", error)
    return {
      success: false,
      distance_km: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Busca a taxa de entrega baseada na distância usando as regras do banco
 */
export async function getFeeByDistance(
  restaurantId: string,
  distanceKm: number,
): Promise<{ fee: number; rule_applied: string } | null> {
  try {
    const supabase = await createClient()

    const { data: rules, error } = await supabase
      .from("delivery_rules")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .is("neighborhood", null)
      .order("from_km", { ascending: true })

    if (error) throw error

    const distanceRules =
      rules?.filter((rule) => Number.isFinite(Number(rule.from_km)) && Number.isFinite(Number(rule.to_km))) || []

    if (distanceRules.length === 0) {
      console.log("[v0] No delivery rules found for restaurant:", restaurantId)
      return null
    }

    // Encontra a regra aplicável
    for (const rule of distanceRules) {
      const fromKm = Number.parseFloat(rule.from_km)
      const toKm = Number.parseFloat(rule.to_km)

      if (distanceKm >= fromKm && distanceKm < toKm) {
        console.log("[v0] Rule matched:", {
          distance: distanceKm,
          range: `${fromKm}-${toKm} km`,
          fee: rule.fee,
        })
        return {
          fee: Number.parseFloat(rule.fee),
          rule_applied: `${fromKm}-${toKm} km`,
        }
      }
    }

    console.log("[v0] No rule found for distance:", distanceKm)
    return null
  } catch (error) {
    console.error("[v0] Error fetching delivery rules:", error)
    return null
  }
}

/**
 * Calcula a taxa de entrega completa: prioriza bairro, depois distância
 */
export async function calculateDeliveryFee(
  restaurantId: string,
  restaurantAddress: string,
  customerAddress: string,
  customerNeighborhood?: string | null, // Added neighborhood parameter
): Promise<DeliveryFeeResult> {
  console.log("[v0] calculateDeliveryFee called:", {
    restaurantId,
    restaurantAddress,
    customerAddress,
    customerNeighborhood,
  })

  const normalizedNeighborhood = customerNeighborhood?.trim()

  if (normalizedNeighborhood) {
    try {
      const neighborhoodFee = await findDeliveryFeeForNeighborhood(restaurantId, normalizedNeighborhood)

      if (neighborhoodFee !== null) {
        console.log("[v0] Using neighborhood-based fee:", {
          neighborhood: normalizedNeighborhood,
          fee: neighborhoodFee,
        })

        return {
          success: true,
          distance_km: 0, // Not calculated for neighborhood
          fee: neighborhoodFee,
          rule_applied: `Bairro: ${normalizedNeighborhood}`,
        }
      }
    } catch (error) {
      console.error("[v0] Error fetching neighborhood fee:", error)
      // Continue to distance-based calculation as fallback
    }
  }

  console.log("[v0] No neighborhood fee found, calculating by distance")

  // 1. Calcular distância via Google Maps
  const distanceResult = await calculateDistance(restaurantAddress, customerAddress)

  if (!distanceResult.success) {
    console.log("[v0] Distance calculation failed:", distanceResult.error)
    return {
      success: false,
      distance_km: 0,
      fee: 0,
      error: distanceResult.error,
    }
  }

  // 2. Buscar taxa baseada na distância
  const feeResult = await getFeeByDistance(restaurantId, distanceResult.distance_km)

  if (!feeResult) {
    console.log("[v0] No fee rule found, using default 0")
    return {
      success: true,
      distance_km: distanceResult.distance_km,
      fee: 0,
      rule_applied: "none",
    }
  }

  console.log("[v0] Delivery fee calculated successfully:", {
    distance_km: distanceResult.distance_km,
    fee: feeResult.fee,
    rule: feeResult.rule_applied,
  })

  return {
    success: true,
    distance_km: distanceResult.distance_km,
    fee: feeResult.fee,
    rule_applied: feeResult.rule_applied,
  }
}

/**
 * Monta o endereço completo para cálculo de distância
 */
export function buildFullAddress(
  street: string,
  number: string | null,
  neighborhood: string,
  city: string,
  state = "SP",
): string {
  const parts = [street, number || "s/n", neighborhood, city, state, "Brasil"]
  return parts.filter(Boolean).join(", ")
}
