import { createClient } from "@/lib/supabase/server"
import type { Addon } from "@/src/domain/types"

export interface AddonInput {
  name: string
  category: string
  price: number
  is_active?: boolean
}

export async function listAddons(restaurantId: string, includeInactive = true): Promise<Addon[]> {
  const supabase = await createClient()
  let query = supabase.from("addons").select("*").eq("restaurant_id", restaurantId)

  if (!includeInactive) {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query.order("name")
  if (error) throw error
  return data as Addon[]
}

export async function getAddonById(id: string): Promise<Addon | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("addons").select("*").eq("id", id).single()
  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }
  return data as Addon
}

export async function createAddon(restaurantId: string, input: AddonInput): Promise<Addon> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("addons")
    .insert({
      restaurant_id: restaurantId,
      name: input.name,
      category: input.category,
      price: input.price,
      is_active: input.is_active ?? true,
    })
    .select()
    .single()

  if (error) throw error
  return data as Addon
}

export async function updateAddon(id: string, updates: Partial<AddonInput>): Promise<Addon> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("addons")
    .update({
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.category !== undefined ? { category: updates.category } : {}),
      ...(updates.price !== undefined ? { price: updates.price } : {}),
      ...(updates.is_active !== undefined ? { is_active: updates.is_active } : {}),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data as Addon
}

export async function deleteAddon(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from("addons").delete().eq("id", id)
  if (error) throw error
}
