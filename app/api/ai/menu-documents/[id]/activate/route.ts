import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
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
      .select("id")
      .eq("id", id)
      .eq("restaurant_id", restaurant.id)
      .single()

    if (targetError || !targetDoc) {
      return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 })
    }

    const { error: deactivateError } = await supabase
      .from("ai_menu_documents")
      .update({ is_active: false })
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)

    if (deactivateError) {
      console.error("[ai/menu-documents/activate] deactivate error:", deactivateError)
      return NextResponse.json({ error: "Falha ao atualizar documento" }, { status: 500 })
    }

    const { error: activateError } = await supabase.from("ai_menu_documents").update({ is_active: true }).eq("id", id)

    if (activateError) {
      console.error("[ai/menu-documents/activate] activate error:", activateError)
      return NextResponse.json({ error: "Falha ao ativar documento" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[ai/menu-documents/activate] unexpected error:", error)
    return NextResponse.json({ error: "Falha ao ativar documento" }, { status: 500 })
  }
}
