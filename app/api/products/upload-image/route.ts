import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo invalido" }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Supabase nao configurado" }, { status: 500 })
    }

    const extension = file.name.split(".").pop() || "jpg"
    const fileName = `${crypto.randomUUID()}.${extension}`
    const filePath = `products/${fileName}`
    const buffer = new Uint8Array(await file.arrayBuffer())

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { error: uploadError } = await supabase.storage.from("product-images").upload(filePath, buffer, {
      upsert: true,
      contentType: file.type || "image/jpeg",
    })

    if (uploadError) {
      console.error("[upload-image] Upload error:", uploadError)
      return NextResponse.json({ error: "Falha ao enviar imagem" }, { status: 500 })
    }

    const { data } = supabase.storage.from("product-images").getPublicUrl(filePath)

    return NextResponse.json({ url: data.publicUrl })
  } catch (error) {
    console.error("[upload-image] Error:", error)
    return NextResponse.json({ error: "Falha ao enviar imagem" }, { status: 500 })
  }
}
