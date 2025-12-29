import { NextResponse } from "next/server"
import { getFirstRestaurant } from "@/src/services/restaurantsService"
import { listProducts } from "@/src/services/productsService"
import { listPaymentMethods } from "@/src/services/paymentMethodsService"
import { listAddons } from "@/src/services/addonsService"

export async function GET() {
  try {
    const restaurant = await getFirstRestaurant()

    // If no restaurant found, we can't proceed
    if (!restaurant) {
      return NextResponse.json({ error: "No restaurant configured" }, { status: 404 })
    }

    // Now fetch products and payment methods with the correct restaurant_id
    const [products, paymentMethods, addons] = await Promise.all([
      listProducts(restaurant.id, { is_active: true, include_addons: true }),
      listPaymentMethods(restaurant.id, true),
      listAddons(restaurant.id, true),
    ])

    return NextResponse.json({
      restaurant,
      products,
      paymentMethods,
      addons,
    })
  } catch (error) {
    console.error("Error loading PDV initial data:", error)
    return NextResponse.json({ error: "Failed to load initial data" }, { status: 500 })
  }
}
