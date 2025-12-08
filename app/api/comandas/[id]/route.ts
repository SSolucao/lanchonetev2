import { type NextRequest, NextResponse } from "next/server"
import { getComandaById, deleteComanda } from "@/src/services/comandasService"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const comanda = await getComandaById(id)

    if (!comanda) {
      return NextResponse.json({ error: "Comanda not found" }, { status: 404 })
    }

    return NextResponse.json(comanda)
  } catch (error: any) {
    console.error("Error fetching comanda:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch comanda" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await deleteComanda(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting comanda:", error)
    return NextResponse.json({ error: error.message || "Failed to delete comanda" }, { status: 500 })
  }
}
