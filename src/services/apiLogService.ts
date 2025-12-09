import { createClient } from "@/lib/supabase/server"

type ApiLogInput = {
  route: string
  method: string
  status_code: number
  duration_ms?: number
  source?: string
  restaurant_id?: string | null
  user_id?: string | null
  customer_id?: string | null
  order_id?: string | null
  ip?: string | null
  user_agent?: string | null
  correlation_id?: string | null
  error?: string | null
  request_body?: any
  response_body?: any
  metadata?: Record<string, any> | null
}

// Best-effort logger to api_logs. Swallows its own errors to avoid breaking flows.
export async function logApiCall(input: ApiLogInput) {
  try {
    const supabase = await createClient()
    const payload = {
      ...input,
      request_body: input.request_body ?? null,
      response_body: input.response_body ?? null,
      metadata: input.metadata ?? null,
    }
    await supabase.from("api_logs").insert(payload)
  } catch (err) {
    console.error("[api_log] Failed to write api_logs:", err)
  }
}
