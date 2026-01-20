import { type NextRequest, NextResponse } from "next/server"
import { getCurrentRestaurant } from "@/src/services/restaurantsService"
import { getNextOrderNumber, createOrderWithItems } from "@/src/services/ordersService"
import { notifyOrderEnteredEmPreparo } from "@/src/services/orderStatusEvents"
import { createClient } from "@/lib/supabase/server"

// API para criar pedido a partir de uma comanda
export async function POST(request: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    const body = await request.json()

    console.log("[v0] Creating order for comanda:", body.comanda_id)
    console.log("[v0] Order items:", body.items)

    const { comanda_id, items } = body

    if (!comanda_id) {
      return NextResponse.json({ error: "comanda_id é obrigatório" }, { status: 400 })
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Items são obrigatórios" }, { status: 400 })
    }

    const supabase = await createClient()

    // Verificar se a comanda existe e está aberta
    const { data: comanda, error: comandaError } = await supabase
      .from("comandas")
      .select("*")
      .eq("id", comanda_id)
      .eq("status", "ABERTA")
      .single()

    if (comandaError || !comanda) {
      console.error("[v0] Comanda not found or error:", comandaError)
      return NextResponse.json({ error: "Comanda não encontrada ou já fechada" }, { status: 404 })
    }

    console.log("[v0] Comanda found:", comanda)

    // Buscar produtos para calcular preços
    const productIds = items.map((item: any) => item.product_id)
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, price, name, requires_kitchen")
      .in("id", productIds)

    if (productsError) {
      console.error("[v0] Products error:", productsError)
      throw productsError
    }

    console.log("[v0] Products found:", products?.length)

    const productMap = new Map(products?.map((p) => [p.id, p]))

    // Calcular total e preparar items
    let total = 0
    let requiresKitchen = false
    const orderItems = items.map((item: any) => {
      const product = productMap.get(item.product_id)
      if (!product) {
        throw new Error(`Produto não encontrado: ${item.product_id}`)
      }

      if (product.requires_kitchen) {
        requiresKitchen = true
      }

      const itemTotal = product.price * item.quantity
      total += itemTotal

      return {
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: product.price,
        total_price: itemTotal,
        notes: item.notes || null,
        addons:
          item.addons?.map((addon: any) => ({
            addon_id: addon.addon_id,
            quantity: addon.quantity,
          })) || [],
      }
    })

    console.log("[v0] Order total:", total)

    // Obter próximo número do pedido
    const orderNumber = await getNextOrderNumber(restaurant.id)
    console.log("[v0] Next order number:", orderNumber)

    // Criar pedido
    const orderInput = {
      restaurant_id: restaurant.id,
      order_number: orderNumber,
      customer_id: comanda.customer_id,
      comanda_id: comanda_id,
      channel: "BALCAO" as const,
      tipo_pedido: "COMANDA" as const,
      subtotal: total,
      delivery_fee: 0,
      total: total,
      status: (requiresKitchen ? "EM_PREPARO" : "FINALIZADO") as const,
      payment_status: "PENDENTE" as const,
      payment_method_id: null,
      notes: null,
    }

    const { order, items: createdItems } = await createOrderWithItems(orderInput, orderItems)
    console.log("[v0] Order created with id:", order.id)

    notifyOrderEnteredEmPreparo({
      orderId: order.id,
      restaurantId: order.restaurant_id,
    }).catch((error) => console.error("[v0] Error notifying EM_PREPARO on comanda create:", error))

    // Atualizar total da comanda
    const newTotal = comanda.total + (Number(order.total) || 0)
    const { error: updateError } = await supabase.from("comandas").update({ total: newTotal }).eq("id", comanda_id)

    if (updateError) {
      console.error("[v0] Error updating comanda total:", updateError)
    } else {
      console.log("[v0] Comanda total updated to:", newTotal)
    }

    return NextResponse.json(
      {
        success: true,
        order,
        items: createdItems,
        comanda_total: newTotal,
      },
      { status: 201 },
    )
  } catch (error: any) {
    console.error("[v0] Error creating comanda order:", error)
    return NextResponse.json({ error: error.message || "Failed to create order" }, { status: 500 })
  }
}
