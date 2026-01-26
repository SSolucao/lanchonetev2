import { createClient } from "@/lib/supabase/server"
import type { Restaurant, CreateRestaurantInput, BusinessHour } from "@/src/domain/types"

/**
 * Service layer for Restaurant operations
 * All functions interact with Supabase directly
 */

export async function listRestaurants(): Promise<Restaurant[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("restaurants").select("*").order("name")

  if (error) throw error
  return data as Restaurant[]
}

export async function getRestaurantById(id: string): Promise<Restaurant | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("restaurants").select("*").eq("id", id).single()

  if (error) {
    if (error.code === "PGRST116") return null // Not found
    throw error
  }
  const businessHours = await getBusinessHoursByRestaurantId(data.id)
  return { ...(data as Restaurant), business_hours: businessHours }
}

export async function createRestaurant(input: CreateRestaurantInput): Promise<Restaurant> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("restaurants").insert(input).select().single()

  if (error) throw error
  return data as Restaurant
}

export async function updateRestaurant(id: string, updates: Partial<CreateRestaurantInput>): Promise<Restaurant> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("restaurants").update(updates).eq("id", id).select().single()

  if (error) throw error
  return data as Restaurant
}

export async function deleteRestaurant(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from("restaurants").delete().eq("id", id)

  if (error) throw error
}

export async function getFirstRestaurant(): Promise<Restaurant | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("restaurants").select("*").limit(1).single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }
  const businessHours = await getBusinessHoursByRestaurantId(data.id)
  return { ...(data as Restaurant), business_hours: businessHours }
}

export async function getCurrentRestaurant(): Promise<Restaurant | null> {
  return getFirstRestaurant()
}

export async function getBusinessHoursByRestaurantId(restaurantId: string): Promise<BusinessHour[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("business_hours")
    .select("weekday, is_open, intervals")
    .eq("restaurant_id", restaurantId)
    .order("weekday", { ascending: true })

  if (error) throw error
  return (data as BusinessHour[]) || []
}

export async function upsertBusinessHours(restaurantId: string, hours: BusinessHour[]): Promise<void> {
  if (!Array.isArray(hours) || hours.length === 0) return

  const payload = hours
    .filter((day) => Number.isInteger(day.weekday) && day.weekday >= 0 && day.weekday <= 6)
    .map((day) => ({
      restaurant_id: restaurantId,
      weekday: day.weekday,
      is_open: Boolean(day.is_open),
      intervals: Array.isArray(day.intervals) ? day.intervals : [],
    }))

  if (payload.length === 0) return

  const supabase = await createClient()
  const { error } = await supabase.from("business_hours").upsert(payload, {
    onConflict: "restaurant_id,weekday",
  })

  if (error) throw error
}
