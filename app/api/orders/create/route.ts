import { NextResponse } from "next/server"
import { createOrderWithItems } from "@/src/services/ordersService"
import { createClient } from "@/lib/supabase/server"
import { notifyOrderEnteredEmPreparo } from "@/src/services/orderStatusEvents"
import type { CreateOrderInput, CreateOrderItemInput } from "@/src/domain/types"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orderInput, itemsInput } = body as {
      orderInput: CreateOrderInput
      itemsInput: CreateOrderItemInput[]
    }

    if (!orderInput || !itemsInput || itemsInput.length === 0) {
      return NextResponse.json({ error: "Order and items are required" }, { status: 400 })
    }

    if (orderInput.tipo_pedido) {
      const validTipos = ["BALCAO", "RETIRADA", "ENTREGA", "COMANDA"]
      if (!validTipos.includes(orderInput.tipo_pedido)) {
        return NextResponse.json(
          { error: `Invalid tipo_pedido. Must be one of: ${validTipos.join(", ")}` },
          { status: 400 },
        )
      }
    }

    const supabase = await createClient()
    const productIds = Array.from(new Set(itemsInput.map((item) => item.product_id)))
    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select("id, requires_kitchen")
      .in("id", productIds)

    if (productsError) throw productsError

    const requiresKitchen = (productsData || []).some((product: any) => Boolean(product.requires_kitchen))
    const normalizedOrderInput = requiresKitchen
      ? orderInput
      : { ...orderInput, status: "FINALIZADO" as const }

    const result = await createOrderWithItems(normalizedOrderInput, itemsInput)

    if (result.order.status === "EM_PREPARO") {
      notifyOrderEnteredEmPreparo({
        orderId: result.order.id,
        restaurantId: result.order.restaurant_id,
      }).catch((error) => console.error("[v0] Error notifying EM_PREPARO on create:", error))
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error creating order with items:", error)
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
  }
}
