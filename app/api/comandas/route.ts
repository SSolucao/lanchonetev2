import { type NextRequest, NextResponse } from "next/server"
import { getCurrentRestaurant } from "@/src/services/restaurantsService"
import { listComandas, createComanda, type CreateComandaInput } from "@/src/services/comandasService"

export async function GET(request: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get("status") as "ABERTA" | "FECHADA" | null

    const comandas = await listComandas(restaurant.id, status || undefined)

    return NextResponse.json(comandas)
  } catch (error: any) {
    console.error("Error fetching comandas:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch comandas" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    const body = await request.json()

    const input: CreateComandaInput = {
      restaurant_id: restaurant.id,
      mesa: body.mesa,
      customer_name: body.customer_name || null,
    }

    const comanda = await createComanda(input)

    return NextResponse.json(comanda, { status: 201 })
  } catch (error: any) {
    console.error("Error creating comanda:", error)
    return NextResponse.json({ error: error.message || "Failed to create comanda" }, { status: 500 })
  }
}
