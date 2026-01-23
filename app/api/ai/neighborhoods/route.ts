import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logApiCall } from "@/src/services/apiLogService"

// GET /api/ai/neighborhoods
export async function GET(request: Request) {
  const startedAt = Date.now()
  let statusCode = 200

  try {
    const supabase = await createClient()
    const { data: restaurant } = await supabase.from("restaurants").select("*").limit(1).single()

    if (!restaurant) {
      statusCode = 404
      await logApiCall({
        route: "/api/ai/neighborhoods",
        method: "GET",
        status_code: statusCode,
        duration_ms: Date.now() - startedAt,
        error: "No restaurant found",
      })
      return NextResponse.json({ error: "No restaurant found" }, { status: statusCode })
    }

    const { data: rules, error } = await supabase
      .from("delivery_rules")
      .select("id, neighborhood, fee")
      .eq("restaurant_id", restaurant.id)
      .not("neighborhood", "is", null)
      .neq("neighborhood", "")
      .order("neighborhood", { ascending: true })

    if (error) throw error

    const neighborhoods =
      rules?.map((rule) => ({
        id: rule.id,
        name: rule.neighborhood,
        fee: rule.fee,
      })) || []

    const response = {
      neighborhoods,
    }

    await logApiCall({
      route: "/api/ai/neighborhoods",
      method: "GET",
      status_code: statusCode,
      duration_ms: Date.now() - startedAt,
      response_body: response,
      restaurant_id: restaurant.id,
      metadata: { neighborhoods_count: neighborhoods.length },
    })

    return NextResponse.json(response)
  } catch (error) {
    statusCode = 500
    console.error("[v0] Error in GET /api/ai/neighborhoods:", error)
    await logApiCall({
      route: "/api/ai/neighborhoods",
      method: "GET",
      status_code: statusCode,
      duration_ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to list neighborhoods" }, { status: statusCode })
  }
}
