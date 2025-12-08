import { createClient } from "@/lib/supabase/server"
import type { User, CreateUserInput } from "@/src/domain/types"

/**
 * Service layer for User operations
 */

export async function listUsers(restaurantId: string): Promise<User[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("users").select("*").eq("restaurant_id", restaurantId).order("name")

  if (error) throw error
  return data as User[]
}

export async function getUserById(id: string): Promise<User | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("users").select("*").eq("id", id).single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }
  return data as User
}

export async function getUserByLogin(restaurantId: string, login: string): Promise<User | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("login", login)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }
  return data as User
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("users").insert(input).select().single()

  if (error) throw error
  return data as User
}

export async function updateUser(id: string, updates: Partial<Omit<CreateUserInput, "restaurant_id">>): Promise<User> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("users").update(updates).eq("id", id).select().single()

  if (error) throw error
  return data as User
}

export async function deleteUser(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from("users").delete().eq("id", id)

  if (error) throw error
}
