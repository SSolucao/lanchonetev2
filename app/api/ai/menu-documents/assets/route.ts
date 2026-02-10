import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const AI_MENU_BUCKET = "ai-menu-documents"

type MenuDocumentRow = {
  id: string
  file_name: string
  description: string | null
  storage_path: string
  mime_type: string
  is_active: boolean
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null
  return createSupabaseClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function getCurrentRestaurantId() {
  const supabase = await createClient()
  const { data: restaurant, error } = await supabase.from("restaurants").select("id").limit(1).single()
  if (error || !restaurant) return null
  return restaurant.id as string
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get("active_only") === "1"

    const restaurantId = await getCurrentRestaurantId()
    if (!restaurantId) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    const supabase = await createClient()
    let query = supabase
      .from("ai_menu_documents")
      .select("id,file_name,description,storage_path,mime_type,is_active")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })

    if (activeOnly) {
      query = query.eq("is_active", true)
    }

    const { data, error } = await query
    if (error) {
      console.error("[ai/menu-documents/assets] list error:", error)
      return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 })
    }

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: "Supabase admin não configurado" }, { status: 500 })
    }

    const items = await Promise.all(
      ((data || []) as MenuDocumentRow[]).map(async (doc) => {
        const { data: signed } = await admin.storage.from(AI_MENU_BUCKET).createSignedUrl(doc.storage_path, 60 * 60)
        return {
          url: signed?.signedUrl ?? null,
          description: doc.description,
          mime_type: doc.mime_type,
          file_name: doc.file_name,
          is_active: doc.is_active,
        }
      }),
    )

    return NextResponse.json(items.filter((item) => Boolean(item.url)))
  } catch (error) {
    console.error("[ai/menu-documents/assets] unexpected error:", error)
    return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 })
  }
}
