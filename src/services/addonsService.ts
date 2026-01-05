import { createClient } from "@/lib/supabase/server"
import type { Addon } from "@/src/domain/types"

export interface AddonInput {
  name: string
  category?: string
  categories?: string[]
  price: number
  is_active?: boolean
}

export async function listAddons(restaurantId: string, includeInactive = true): Promise<Addon[]> {
  const supabase = await createClient()
  let query = supabase
    .from("addons")
    .select(
      `
      *,
      addon_categories:addon_categories(category)
    `,
    )
    .eq("restaurant_id", restaurantId)

  if (!includeInactive) {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query.order("name")
  if (error) throw error
  return (data || []).map((addon: any) => ({
    ...addon,
    categories: (addon.addon_categories || []).map((c: any) => c?.category).filter(Boolean),
  })) as Addon[]
}

export async function getAddonById(id: string): Promise<Addon | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("addons")
    .select(
      `
      *,
      addon_categories:addon_categories(category)
    `,
    )
    .eq("id", id)
    .single()
  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }
  return data
    ? ({
        ...data,
        categories: (data as any).addon_categories?.map((c: any) => c?.category).filter(Boolean),
      } as Addon)
    : null
}

export async function createAddon(restaurantId: string, input: AddonInput): Promise<Addon> {
  const supabase = await createClient()
  const normalizedCategories =
    input.categories && Array.isArray(input.categories)
      ? Array.from(new Set(input.categories.map((c) => c?.trim()).filter(Boolean)))
      : undefined
  const legacyCategory = input.category || normalizedCategories?.[0]

  const { data, error } = await supabase
    .from("addons")
    .insert({
      restaurant_id: restaurantId,
      name: input.name,
      category: legacyCategory,
      price: input.price,
      is_active: input.is_active ?? true,
    })
    .select()
    .single()

  if (error) throw error

  const addon = data as Addon

  if (normalizedCategories && normalizedCategories.length > 0) {
    const { error: linkError } = await supabase
      .from("addon_categories")
      .insert(normalizedCategories.map((category) => ({ addon_id: addon.id, category })))
    if (linkError) throw linkError
    addon.categories = normalizedCategories
  }

  return addon
}

export async function updateAddon(id: string, updates: Partial<AddonInput>): Promise<Addon> {
  const supabase = await createClient()
  const normalizedCategories =
    updates.categories && Array.isArray(updates.categories)
      ? Array.from(new Set(updates.categories.map((c) => c?.trim()).filter(Boolean)))
      : undefined

  const { data, error } = await supabase
    .from("addons")
    .update({
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.category !== undefined || normalizedCategories !== undefined
        ? { category: updates.category ?? normalizedCategories?.[0] }
        : {}),
      ...(updates.price !== undefined ? { price: updates.price } : {}),
      ...(updates.is_active !== undefined ? { is_active: updates.is_active } : {}),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error

  const addon = data as Addon

  if (normalizedCategories) {
    const { error: deleteError } = await supabase.from("addon_categories").delete().eq("addon_id", id)
    if (deleteError) throw deleteError

    if (normalizedCategories.length > 0) {
      const { error: insertError } = await supabase
        .from("addon_categories")
        .insert(normalizedCategories.map((category) => ({ addon_id: id, category })))
      if (insertError) throw insertError
    }
    addon.categories = normalizedCategories
  }

  return addon
}

export async function deleteAddon(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from("addons").delete().eq("id", id)
  if (error) throw error
}
