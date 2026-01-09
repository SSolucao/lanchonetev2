import { NextResponse } from "next/server"
import { getRestaurantById } from "@/src/services/restaurantsService"
import { createClient } from "@/lib/supabase/server"

function isAuthorized(request: Request): boolean {
  const expected = process.env.ADMIN_API_TOKEN
  if (!expected) {
    console.warn("[admin_api] Missing ADMIN_API_TOKEN; denying request")
    return false
  }

  const provided = request.headers.get("x-admin-token")
  return Boolean(provided) && provided === expected
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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
      .select("id, name, is_active")
      .eq("restaurant_id", restaurant.id)
      .order("name", { ascending: true })

    // Admin payload includes Pix
    const adminRestaurant = {
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
      consumption_eta_min: restaurant.consumption_eta_min ?? null,
      consumption_eta_max: restaurant.consumption_eta_max ?? null,
      pix_key_type: restaurant.pix_key_type ?? null,
      pix_key: restaurant.pix_key ?? null,
      payment_methods: paymentMethods || [],
    }

    return NextResponse.json(adminRestaurant)
  } catch (error) {
    console.error("Error getting admin restaurant by id:", error)
    return NextResponse.json({ error: "Failed to get restaurant" }, { status: 500 })
  }
}
