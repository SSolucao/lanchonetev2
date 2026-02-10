import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const AI_MENU_BUCKET = "ai-menu-documents"
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024

type MenuDocumentRow = {
  id: string
  file_name: string
  description: string | null
  storage_path: string
  mime_type: string
  file_size: number
  is_active: boolean
  created_at: string
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

async function mapDocumentsWithSignedUrl(documents: MenuDocumentRow[]) {
  const admin = getSupabaseAdmin()
  if (!admin || documents.length === 0) {
    return documents.map((doc) => ({ ...doc, download_url: null }))
  }

  const withUrls = await Promise.all(
    documents.map(async (doc) => {
      const { data } = await admin.storage.from(AI_MENU_BUCKET).createSignedUrl(doc.storage_path, 60 * 60)
      return { ...doc, download_url: data?.signedUrl ?? null }
    }),
  )

  return withUrls
}

export async function GET() {
  try {
    const restaurantId = await getCurrentRestaurantId()
    if (!restaurantId) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("ai_menu_documents")
      .select("id,file_name,description,storage_path,mime_type,file_size,is_active,created_at")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[ai/menu-documents][GET] Error:", error)
      return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 })
    }

    const documents = await mapDocumentsWithSignedUrl((data || []) as MenuDocumentRow[])
    return NextResponse.json(documents)
  } catch (error) {
    console.error("[ai/menu-documents][GET] Unexpected error:", error)
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const restaurantId = await getCurrentRestaurantId()
    if (!restaurantId) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get("file")
    const descriptionRaw = formData.get("description")
    const description =
      typeof descriptionRaw === "string" && descriptionRaw.trim() ? descriptionRaw.trim().slice(0, 160) : null

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 })
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Formato inválido. Envie PDF, JPG, PNG ou WEBP." }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "Arquivo excede 15 MB" }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: "Supabase admin não configurado" }, { status: 500 })
    }

    const extension = file.name.includes(".") ? file.name.split(".").pop() : undefined
    const safeExtension = (extension || (file.type === "application/pdf" ? "pdf" : "bin")).toLowerCase()
    const filePath = `${restaurantId}/${crypto.randomUUID()}.${safeExtension}`

    const fileBuffer = new Uint8Array(await file.arrayBuffer())

    const { error: uploadError } = await admin.storage.from(AI_MENU_BUCKET).upload(filePath, fileBuffer, {
      upsert: false,
      contentType: file.type,
    })

    if (uploadError) {
      console.error("[ai/menu-documents][POST] Upload error:", uploadError)
      return NextResponse.json({ error: "Falha ao enviar arquivo" }, { status: 500 })
    }

    const { data: currentActive } = await admin
      .from("ai_menu_documents")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .limit(1)

    const shouldBeActive = !currentActive || currentActive.length === 0

    const { data: inserted, error: insertError } = await admin
      .from("ai_menu_documents")
      .insert({
        restaurant_id: restaurantId,
        file_name: file.name,
        description,
        storage_path: filePath,
        mime_type: file.type,
        file_size: file.size,
        is_active: shouldBeActive,
      })
      .select("id,file_name,description,storage_path,mime_type,file_size,is_active,created_at")
      .single()

    if (insertError || !inserted) {
      await admin.storage.from(AI_MENU_BUCKET).remove([filePath])
      console.error("[ai/menu-documents][POST] Insert error:", insertError)
      return NextResponse.json({ error: "Falha ao salvar documento" }, { status: 500 })
    }

    const [documentWithUrl] = await mapDocumentsWithSignedUrl([inserted as MenuDocumentRow])
    return NextResponse.json(documentWithUrl, { status: 201 })
  } catch (error) {
    console.error("[ai/menu-documents][POST] Unexpected error:", error)
    return NextResponse.json({ error: "Falha ao enviar arquivo" }, { status: 500 })
  }
}
