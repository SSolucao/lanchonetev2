import { NextResponse } from "next/server"
import { getRestaurantById } from "@/src/services/restaurantsService"
import { createClient } from "@/lib/supabase/server"

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

    const supabase = await createClient()
    const { data: paymentMethods } = await supabase
      .from("payment_methods")
      .select("id, name")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("name", { ascending: true })

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
      payment_methods: paymentMethods || [],
    }

    return NextResponse.json(publicRestaurant)
  } catch (error) {
    console.error("Error getting restaurant by id:", error)
    return NextResponse.json({ error: "Failed to get restaurant" }, { status: 500 })
  }
}
