import { NextResponse } from "next/server"
import { getRestaurantById } from "@/src/services/restaurantsService"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    if (!id) {
      return NextResponse.json({ error: "Restaurant id is required" }, { status: 400 })
    }

    const restaurant = await getRestaurantById(id)
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    // Public payload: do not expose admin-only fields (ex: pix_key)
    const publicRestaurant = {
      id: restaurant.id,
      name: restaurant.name,
      cep_origem: restaurant.cep_origem,
      address: restaurant.address,
      street: restaurant.street ?? null,
      number: restaurant.number ?? null,
      neighborhood: restaurant.neighborhood ?? null,
      city: restaurant.city ?? null,
      state: restaurant.state ?? null,
      delivery_eta_min: restaurant.delivery_eta_min ?? null,
      delivery_eta_max: restaurant.delivery_eta_max ?? null,
    }

    return NextResponse.json(publicRestaurant)
  } catch (error) {
    console.error("Error getting restaurant by id:", error)
    return NextResponse.json({ error: "Failed to get restaurant" }, { status: 500 })
  }
}

