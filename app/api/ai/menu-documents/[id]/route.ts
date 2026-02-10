import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const AI_MENU_BUCKET = "ai-menu-documents"

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null
  return createSupabaseClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: "Document id is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: restaurant } = await supabase.from("restaurants").select("id").limit(1).single()
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    const { data: targetDoc, error: targetError } = await supabase
      .from("ai_menu_documents")
      .select("id,storage_path,is_active")
      .eq("id", id)
      .eq("restaurant_id", restaurant.id)
      .single()

    if (targetError || !targetDoc) {
      return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 })
    }

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: "Supabase admin não configurado" }, { status: 500 })
    }

    const { error: deleteDbError } = await supabase
      .from("ai_menu_documents")
      .delete()
      .eq("id", id)
      .eq("restaurant_id", restaurant.id)

    if (deleteDbError) {
      console.error("[ai/menu-documents][DELETE] DB error:", deleteDbError)
      return NextResponse.json({ error: "Falha ao excluir documento" }, { status: 500 })
    }

    if (targetDoc.storage_path) {
      const { error: storageError } = await admin.storage.from(AI_MENU_BUCKET).remove([targetDoc.storage_path])
      if (storageError) {
        console.error("[ai/menu-documents][DELETE] Storage remove error:", storageError)
      }
    }

    if (targetDoc.is_active) {
      const { data: newestDoc } = await supabase
        .from("ai_menu_documents")
        .select("id")
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (newestDoc?.id) {
        const { error: activateFallbackError } = await supabase
          .from("ai_menu_documents")
          .update({ is_active: true })
          .eq("id", newestDoc.id)

        if (activateFallbackError) {
          console.error("[ai/menu-documents][DELETE] Fallback activate error:", activateFallbackError)
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[ai/menu-documents][DELETE] unexpected error:", error)
    return NextResponse.json({ error: "Falha ao excluir documento" }, { status: 500 })
  }
}
