import { createClient } from "@/lib/supabase/server"
import type { Restaurant, CreateRestaurantInput } from "@/src/domain/types"

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
  return data as Restaurant
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
  return data as Restaurant
}

export async function getCurrentRestaurant(): Promise<Restaurant | null> {
  return getFirstRestaurant()
}
