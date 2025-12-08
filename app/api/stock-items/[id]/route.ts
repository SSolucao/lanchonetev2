import { NextResponse } from "next/server"
import { updateStockItem, deleteStockItem } from "@/src/services/stockService"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    const stockItem = await updateStockItem(id, body)

    return NextResponse.json(stockItem)
  } catch (error) {
    console.error("Error updating stock item:", error)
    return NextResponse.json({ error: "Failed to update stock item" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    await deleteStockItem(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting stock item:", error)
    return NextResponse.json({ error: "Failed to delete stock item" }, { status: 500 })
  }
}
