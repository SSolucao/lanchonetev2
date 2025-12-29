import { createClient } from "@/lib/supabase/server"
import type {
  Product,
  CreateProductInput,
  ProductComboItem,
  ProductRecipeItem as ExistingProductRecipeItem,
  SaveRecipeItemInput as ExistingSaveRecipeItemInput,
} from "@/src/domain/types"

/**
 * Service layer for Product operations
 */

export interface ProductFilters {
  type?: "UNIT" | "COMBO"
  category?: string
  is_active?: boolean
  include_inactive?: boolean
  include_addons?: boolean
}

export async function listProducts(restaurantId: string, filters?: ProductFilters): Promise<Product[]> {
  const supabase = await createClient()
  let query = supabase
    .from("products")
    .select(
      filters?.include_addons
        ? `
        *,
        product_addons:product_addons(
          addon:addons(id, name, category, price, is_active)
        )
      `
        : "*",
    )
    .eq("restaurant_id", restaurantId)

  if (!filters?.include_inactive) {
    const activeFilter = filters?.is_active ?? true
    query = query.eq("is_active", activeFilter)
  }

  if (filters?.type) {
    query = query.eq("type", filters.type)
  }
  if (filters?.category) {
    query = query.eq("category", filters.category)
  }

  const { data, error } = await query.order("name")

  if (error) throw error

  if (filters?.include_addons) {
    return (data as any[]).map((p) => ({
      ...p,
      addons:
        p.product_addons
          ?.map((pa: any) => pa.addon)
          ?.filter((a: any) => !!a) || [],
    }))
  }

  return data as Product[]
}

export async function getProductById(id: string): Promise<Product | null> {
  if (!id || id === "undefined" || id === "null") {
    console.error("[v0] getProductById called with invalid ID:", id)
    return null
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from("products").select("*").eq("id", id).single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }
  return data as Product
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("products").insert(input).select().single()

  if (error) throw error
  return data as Product
}

export async function updateProduct(
  id: string,
  updates: Partial<Omit<CreateProductInput, "restaurant_id">>,
): Promise<Product> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("products").update(updates).eq("id", id).select().single()

  if (error) throw error
  return data as Product
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = await createClient()

  // Block deletion if product is used in orders
  const { data: linkedOrderItem, error: linkedError } = await supabase
    .from("order_items")
    .select("id")
    .eq("product_id", id)
    .limit(1)

  if (linkedError) throw linkedError
  if (linkedOrderItem && linkedOrderItem.length > 0) {
    const err = new Error("Produto possui pedidos vinculados")
    ;(err as any).code = "PRODUCT_IN_USE"
    ;(err as any).status = 409
    throw err
  }

  const { error } = await supabase.from("products").delete().eq("id", id)

  if (error) throw error
}

// Combo-specific operations

export async function getComboItems(comboId: string): Promise<ProductComboItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("product_combo_items").select("*").eq("combo_id", comboId)

  if (error) throw error
  return data as ProductComboItem[]
}

export async function addComboItem(
  restaurantId: string,
  comboId: string,
  productId: string,
  quantity: number,
): Promise<ProductComboItem> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("product_combo_items")
    .insert({
      restaurant_id: restaurantId,
      combo_id: comboId,
      product_id: productId,
      quantity,
    })
    .select()
    .single()

  if (error) throw error
  return data as ProductComboItem
}

export async function removeComboItem(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from("product_combo_items").delete().eq("id", id)

  if (error) throw error
}

export async function updateComboItem(id: string, quantity: number): Promise<ProductComboItem> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("product_combo_items").update({ quantity }).eq("id", id).select().single()

  if (error) throw error
  return data as ProductComboItem
}

// Helper functions for combo operations with items

export interface ProductComboItemWithProduct extends ProductComboItem {
  product?: Product
}

export async function getComboWithItems(comboId: string): Promise<{
  combo: Product
  items: ProductComboItemWithProduct[]
}> {
  if (!comboId || comboId === "undefined" || comboId === "null") {
    console.error("[v0] getComboWithItems called with invalid comboId:", comboId)
    throw new Error("Invalid combo ID provided")
  }

  const supabase = await createClient()

  // Get combo
  const { data: combo, error: comboError } = await supabase.from("products").select("*").eq("id", comboId).single()

  if (comboError) throw comboError

  // Get combo items with product details
  const { data: items, error: itemsError } = await supabase
    .from("product_combo_items")
    .select(`
      *,
      product:products(*)
    `)
    .eq("combo_id", comboId)

  if (itemsError) throw itemsError

  return {
    combo: combo as Product,
    items: items as ProductComboItemWithProduct[],
  }
}

// Product recipe management functions

export interface SaveComboItemInput {
  product_id: string
  quantity: number
}

// Use existing interfaces to avoid redeclaration
export type ProductRecipeItem = ExistingProductRecipeItem
export type SaveRecipeItemInput = ExistingSaveRecipeItemInput

export async function saveProductWithRecipe(
  restaurantId: string,
  productData: CreateProductInput | { id: string; updates: Partial<CreateProductInput> },
  recipeItems: SaveRecipeItemInput[],
): Promise<Product> {
  const supabase = await createClient()

  let productId: string
  let product: Product

  // Create or update product
  if ("id" in productData) {
    const { is_active, ...otherUpdates } = productData.updates as any
    const updatesToApply = {
      ...otherUpdates,
      ...(is_active !== undefined ? { is_active } : {}),
    }

    console.log("[v0] Updating product with:", updatesToApply)

    const { data, error } = await supabase
      .from("products")
      .update(updatesToApply)
      .eq("id", productData.id)
      .select()
      .single()

    if (error) {
      console.error("[v0] Supabase error updating product:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
      throw error
    }

    product = data as Product
    productId = productData.id

    // Delete existing recipe items
    const { error: deleteError } = await supabase.from("product_stock_recipe").delete().eq("product_id", productId)
    if (deleteError) {
      console.error("[v0] Error deleting recipe items:", deleteError)
      throw deleteError
    }
  } else {
    const { is_active, ...otherData } = productData as any
    const dataToInsert = {
      ...otherData,
      ...(is_active !== undefined ? { is_active } : {}),
    }

    const { data, error } = await supabase.from("products").insert(dataToInsert).select().single()

    if (error) throw error
    product = data as Product
    productId = product.id
  }

  // Insert new recipe items
  if (recipeItems.length > 0) {
    const itemsToInsert = recipeItems.map((item) => ({
      restaurant_id: restaurantId,
      product_id: productId,
      stock_item_id: item.stock_item_id,
      quantity: item.quantity,
    }))

    console.log("[v0] Inserting recipe items:", itemsToInsert)

    const { error } = await supabase.from("product_stock_recipe").insert(itemsToInsert)
    if (error) {
      console.error("[v0] Error inserting recipe items:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
      throw error
    }
  }

  console.log("[v0] Product updated successfully")
  return product
}

export async function saveComboWithItems(
  restaurantId: string,
  comboData: CreateProductInput | { id: string; updates: Partial<CreateProductInput> },
  items: SaveComboItemInput[],
): Promise<Product> {
  const supabase = await createClient()

  let comboId: string
  let combo: Product

  // Create or update combo
  if ("id" in comboData) {
    const { is_active, ...otherUpdates } = comboData.updates as any
    const updatesToApply = {
      ...otherUpdates,
      ...(is_active !== undefined ? { is_active } : {}),
    }

    console.log("[v0] Updating combo with:", updatesToApply)

    const { data, error } = await supabase
      .from("products")
      .update(updatesToApply)
      .eq("id", comboData.id)
      .select()
      .single()

    if (error) {
      console.error("[v0] Supabase error updating combo:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
      throw error
    }

    combo = data as Product
    comboId = comboData.id

    // Delete existing items
    const { error: deleteError } = await supabase.from("product_combo_items").delete().eq("combo_id", comboId)
    if (deleteError) {
      console.error("[v0] Error deleting combo items:", deleteError)
      throw deleteError
    }
  } else {
    const { is_active, ...otherData } = comboData as any
    const dataToInsert = {
      ...otherData,
      ...(is_active !== undefined ? { is_active } : {}),
    }

    const { data, error } = await supabase.from("products").insert(dataToInsert).select().single()

    if (error) throw error
    combo = data as Product
    comboId = combo.id
  }

  // Insert new items
  if (items.length > 0) {
    const itemsToInsert = items.map((item) => ({
      restaurant_id: restaurantId,
      combo_id: comboId,
      product_id: item.product_id,
      quantity: item.quantity,
    }))

    console.log("[v0] Inserting combo items:", itemsToInsert)

    const { error } = await supabase.from("product_combo_items").insert(itemsToInsert)
    if (error) {
      console.error("[v0] Error inserting combo items:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
      throw error
    }
  }

  console.log("[v0] Combo updated successfully")
  return combo
}
