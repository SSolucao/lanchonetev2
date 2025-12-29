import { NextResponse, type NextRequest } from "next/server"
import { getCurrentRestaurant } from "@/src/services/restaurantsService"
import { getAddonById, updateAddon, deleteAddon } from "@/src/services/addonsService"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const addon = await getAddonById(id)
    if (!addon) {
      return NextResponse.json({ error: "Addon not found" }, { status: 404 })
    }
    return NextResponse.json(addon)
  } catch (error) {
    console.error("Error getting addon:", error)
    return NextResponse.json({ error: "Failed to get addon" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    const existing = await getAddonById(id)
    if (!existing) {
      return NextResponse.json({ error: "Addon not found" }, { status: 404 })
    }
    if (existing.restaurant_id !== restaurant.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const body = await request.json()
    const { name, category, price, is_active } = body
    if (name !== undefined && String(name).trim() === "") {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 })
    }
    if (category !== undefined && String(category).trim() === "") {
      return NextResponse.json({ error: "Category cannot be empty" }, { status: 400 })
    }

    const updated = await updateAddon(id, {
      name,
      category,
      price: price !== undefined ? Number(price) : undefined,
      is_active,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating addon:", error)
    return NextResponse.json({ error: "Failed to update addon" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    const existing = await getAddonById(id)
    if (!existing) {
      return NextResponse.json({ error: "Addon not found" }, { status: 404 })
    }
    if (existing.restaurant_id !== restaurant.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    await deleteAddon(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting addon:", error)
    return NextResponse.json({ error: "Failed to delete addon" }, { status: 500 })
  }
}
