import { type NextRequest, NextResponse } from "next/server"
import { getComboWithItems } from "@/src/services/productsService"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const { items } = await getComboWithItems(id)

    const formattedItems = items.map((item) => ({
      product_id: item.product_id,
      product_name: item.product?.name || "Unknown",
      quantity: item.quantity,
    }))

    return NextResponse.json(formattedItems)
  } catch (error) {
    console.error("Error getting combo items:", error)
    return NextResponse.json({ error: "Failed to get combo items" }, { status: 500 })
  }
}
