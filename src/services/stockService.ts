import { createClient } from "@/lib/supabase/server"
import type {
  StockItem,
  CreateStockItemInput,
  ProductStockRecipe,
  StockTransaction,
  CreateStockTransactionInput,
} from "@/src/domain/types"

/**
 * Service layer for Stock operations
 */

// ============================================================================
// STOCK ITEMS
// ============================================================================

export async function listStockItems(restaurantId: string, activeOnly = false): Promise<StockItem[]> {
  const supabase = await createClient()
  let query = supabase.from("stock_items").select("*").eq("restaurant_id", restaurantId)

  if (activeOnly) {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query.order("name")

  if (error) throw error
  return data as StockItem[]
}

export async function getStockItemById(id: string): Promise<StockItem | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("stock_items").select("*").eq("id", id).single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }
  return data as StockItem
}

export async function createStockItem(input: CreateStockItemInput): Promise<StockItem> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("stock_items").insert(input).select().single()

  if (error) throw error
  return data as StockItem
}

export async function updateStockItem(
  id: string,
  updates: Partial<Omit<CreateStockItemInput, "restaurant_id">>,
): Promise<StockItem> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("stock_items").update(updates).eq("id", id).select().single()

  if (error) throw error
  return data as StockItem
}

export async function deleteStockItem(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from("stock_items").delete().eq("id", id)

  if (error) throw error
}

// ============================================================================
// PRODUCT STOCK RECIPE
// ============================================================================

export interface ProductStockRecipeWithItem extends ProductStockRecipe {
  stock_item?: StockItem
}

export async function getProductRecipe(productId: string): Promise<ProductStockRecipeWithItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("product_stock_recipe")
    .select(`
      *,
      stock_item:stock_items(*)
    `)
    .eq("product_id", productId)

  if (error) throw error
  return data as ProductStockRecipeWithItem[]
}

export async function saveProductRecipe(
  restaurantId: string,
  productId: string,
  recipeItems: Array<{ stock_item_id: string; quantity: number }>,
): Promise<void> {
  const supabase = await createClient()

  // Delete existing recipe
  await supabase.from("product_stock_recipe").delete().eq("product_id", productId)

  // Insert new recipe items
  if (recipeItems.length > 0) {
    const itemsToInsert = recipeItems.map((item) => ({
      restaurant_id: restaurantId,
      product_id: productId,
      stock_item_id: item.stock_item_id,
      quantity: item.quantity,
    }))

    const { error } = await supabase.from("product_stock_recipe").insert(itemsToInsert)
    if (error) throw error
  }
}

// ============================================================================
// STOCK TRANSACTIONS
// ============================================================================

export async function createStockTransaction(input: CreateStockTransactionInput): Promise<StockTransaction> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("stock_transactions").insert(input).select().single()

  if (error) throw error
  return data as StockTransaction
}

export async function getStockTransactions(
  restaurantId: string,
  stockItemId?: string,
  limit = 50,
): Promise<StockTransaction[]> {
  const supabase = await createClient()
  let query = supabase.from("stock_transactions").select("*").eq("restaurant_id", restaurantId)

  if (stockItemId) {
    query = query.eq("stock_item_id", stockItemId)
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit)

  if (error) throw error
  return data as StockTransaction[]
}

// ============================================================================
// STOCK MOVEMENT (deduct/add stock with transaction)
// ============================================================================

export async function adjustStockQuantity(
  restaurantId: string,
  stockItemId: string,
  quantityChange: number,
  type: "IN" | "OUT" | "ADJUSTMENT",
  reason?: string,
  orderId?: string,
  userId?: string,
): Promise<void> {
  const supabase = await createClient()

  // Get current stock
  const stockItem = await getStockItemById(stockItemId)
  if (!stockItem) throw new Error("Stock item not found")

  const previousQty = stockItem.current_qty
  const newQty = previousQty + quantityChange

  if (newQty < 0) {
    throw new Error(
      `Insufficient stock for ${stockItem.name}. Available: ${previousQty}, Required: ${Math.abs(quantityChange)}`,
    )
  }

  // Update stock quantity
  await supabase.from("stock_items").update({ current_qty: newQty }).eq("id", stockItemId)

  // Create transaction log
  await createStockTransaction({
    restaurant_id: restaurantId,
    stock_item_id: stockItemId,
    type,
    quantity: Math.abs(quantityChange),
    previous_qty: previousQty,
    new_qty: newQty,
    reason,
    order_id: orderId,
    user_id: userId,
  })
}

// ============================================================================
// DEDUCT STOCK FROM ORDER
// ============================================================================

export async function deductStockFromOrder(
  restaurantId: string,
  orderId: string,
  orderItems: Array<{ product_id: string; quantity: number }>,
): Promise<void> {
  const supabase = await createClient()

  for (const orderItem of orderItems) {
    // Get product recipe
    const recipe = await getProductRecipe(orderItem.product_id)

    // Get product to check if it's a combo
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("*, product_combo_items(*)")
      .eq("id", orderItem.product_id)
      .single()

    if (productError) throw productError

    if (product.type === "COMBO") {
      // For combos, deduct stock from each product in the combo
      const comboItems = product.product_combo_items || []
      for (const comboItem of comboItems) {
        const comboProductRecipe = await getProductRecipe(comboItem.product_id)
        for (const recipeItem of comboProductRecipe) {
          const totalQuantity = recipeItem.quantity * comboItem.quantity * orderItem.quantity
          await adjustStockQuantity(
            restaurantId,
            recipeItem.stock_item_id,
            -totalQuantity,
            "OUT",
            `Pedido #${orderId} - Combo item`,
            orderId,
          )
        }
      }
    } else {
      // For regular products, deduct stock from recipe
      for (const recipeItem of recipe) {
        const totalQuantity = recipeItem.quantity * orderItem.quantity
        await adjustStockQuantity(
          restaurantId,
          recipeItem.stock_item_id,
          -totalQuantity,
          "OUT",
          `Pedido #${orderId}`,
          orderId,
        )
      }
    }
  }
}
