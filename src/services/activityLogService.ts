import { createClient } from "@/lib/supabase/server"
import type { ActivityLog } from "@/src/domain/types"

/**
 * Service layer for Activity Log operations
 */

export interface LogActivityInput {
  restaurant_id: string
  user_id?: string
  action: string
  entity_type: string
  entity_id: string
  metadata?: Record<string, any>
}

export async function logActivity(input: LogActivityInput): Promise<ActivityLog> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("activity_log").insert(input).select().single()

  if (error) throw error
  return data as ActivityLog
}

export async function getActivityLog(
  restaurantId: string,
  filters?: {
    user_id?: string
    entity_type?: string
    entity_id?: string
    date_from?: string
    date_to?: string
    limit?: number
  },
): Promise<ActivityLog[]> {
  const supabase = await createClient()
  let query = supabase.from("activity_log").select("*").eq("restaurant_id", restaurantId)

  if (filters?.user_id) {
    query = query.eq("user_id", filters.user_id)
  }
  if (filters?.entity_type) {
    query = query.eq("entity_type", filters.entity_type)
  }
  if (filters?.entity_id) {
    query = query.eq("entity_id", filters.entity_id)
  }
  if (filters?.date_from) {
    query = query.gte("created_at", filters.date_from)
  }
  if (filters?.date_to) {
    query = query.lte("created_at", filters.date_to)
  }
  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) throw error
  return data as ActivityLog[]
}
