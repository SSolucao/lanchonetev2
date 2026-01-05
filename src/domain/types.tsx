// ==============================================================================
// Domain Types for POS System
// ==============================================================================
// These types match the database schema exactly
// All types use English names aligned with SQL tables
// ==============================================================================

export interface Restaurant {
  id: string
  name: string
  cep_origem: string
  address: string
  street: string | null
  number: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  delivery_eta_min: number | null
  delivery_eta_max: number | null
  pix_key_type: string | null
  pix_key: string | null
  created_at: string
  updated_at: string
}

export type UserRole = "OWNER" | "ATTENDANT" | "KITCHEN" | "VIEW_ONLY"

export interface User {
  id: string
  restaurant_id: string
  name: string
  login: string
  password_hash: string
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  restaurant_id: string
  name: string
  phone: string | null
  cep: string | null
  street: string | null
  number: string | null
  neighborhood: string | null
  city: string | null
  complement: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type ProductType = "UNIT" | "COMBO"

export interface Product {
  id: string
  restaurant_id: string
  name: string
  type: ProductType
  category: string | null
  price: number
  description: string | null
  is_active: boolean
  track_stock: boolean
  stock_qty: number
  low_stock_threshold: number
  created_at: string
  updated_at: string
  addons?: Addon[] // Allowed addons for this product (when included)
}

export interface Addon {
  id: string
  restaurant_id: string
  name: string
  category: string
  categories?: string[] // New multi-category support (phase 1), keeps legacy category for compatibility
  price: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProductComboItem {
  id: string
  restaurant_id: string
  combo_id: string
  product_id: string
  quantity: number
  created_at: string
}

export interface PaymentMethod {
  id: string
  restaurant_id: string
  name: string
  is_active: boolean
  settlement_days: number
  created_at: string
  updated_at: string
}

export interface DeliveryRule {
  id: string
  restaurant_id: string
  from_km: number | null // Now nullable for neighborhood-only rules
  to_km: number | null // Now nullable for neighborhood-only rules
  fee: number
  neighborhood: string | null // Added neighborhood field for location-based rules
  created_at: string
  updated_at: string
}

export type OrderChannel = "BALCAO" | "DELIVERY"
export type DeliveryMode = "NONE" | "RETIRA" | "ENTREGA"
export type TipoPedido = "BALCAO" | "RETIRADA" | "ENTREGA" | "COMANDA"
export type PaymentStatus = "PENDENTE" | "PAGO" | "CANCELADO"
export type OrderStatus = "NOVO" | "EM_PREPARO" | "SAIU_PARA_ENTREGA" | "FINALIZADO" | "CANCELADO"

export type StockUnit = "UN" | "KG" | "G" | "L" | "ML" | "CX" | "PCT"
export type StockTransactionType = "IN" | "OUT" | "ADJUSTMENT"

export interface StockItem {
  id: string
  restaurant_id: string
  name: string
  unit: StockUnit
  current_qty: number
  min_qty: number
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ProductStockRecipe {
  id: string
  restaurant_id: string
  product_id: string
  stock_item_id: string
  quantity: number
  created_at: string
}

export interface StockTransaction {
  id: string
  restaurant_id: string
  stock_item_id: string
  type: StockTransactionType
  quantity: number
  previous_qty: number
  new_qty: number
  reason: string | null
  order_id: string | null
  user_id: string | null
  created_at: string
}
// </CHANGE>

export interface Order {
  id: string
  restaurant_id: string
  order_number: number
  created_at: string
  channel: OrderChannel
  delivery_mode: DeliveryMode
  tipo_pedido?: TipoPedido
  customer_id: string | null
  subtotal: number
  delivery_fee: number
  total: number
  payment_method_id: string | null
  payment_status: PaymentStatus
  status: OrderStatus
  notes: string | null
  kitchen_printed_at: string | null
  customer_printed_at: string | null
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  total_price: number
  notes: string | null
  created_at: string
}

export interface ActivityLog {
  id: string
  restaurant_id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, any> | null
  created_at: string
}

// ==============================================================================
// Input types for creation (without auto-generated fields)
// ==============================================================================

export interface CreateRestaurantInput {
  name: string
  cep_origem: string
  address: string
  street?: string | null
  number?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  delivery_eta_min?: number | null
  delivery_eta_max?: number | null
  pix_key_type?: string | null
  pix_key?: string | null
}

export interface CreateUserInput {
  restaurant_id: string
  name: string
  login: string
  password_hash: string
  role: UserRole
}

export interface CreateCustomerInput {
  restaurant_id: string
  name: string
  phone?: string
  cep?: string
  street?: string
  number?: string
  neighborhood?: string
  city?: string
  complement?: string
  notes?: string
}

export interface CreateProductInput {
  restaurant_id: string
  name: string
  type: ProductType
  category?: string
  price: number
  description?: string
  is_active?: boolean
  track_stock?: boolean
  stock_qty?: number
  low_stock_threshold?: number
}

export interface CreatePaymentMethodInput {
  restaurant_id: string
  name: string
  is_active?: boolean
  settlement_days: number
}

export interface CreateDeliveryRuleInput {
  restaurant_id: string
  from_km?: number // Now optional
  to_km?: number // Now optional
  fee: number
  neighborhood?: string // Added neighborhood support
}

export interface CreateOrderInput {
  restaurant_id: string
  order_number: number
  channel?: OrderChannel
  delivery_mode?: DeliveryMode
  tipo_pedido?: TipoPedido
  customer_id?: string
  subtotal: number
  delivery_fee?: number
  total: number
  payment_method_id?: string
  payment_status: PaymentStatus
  status: OrderStatus
  notes?: string
}

export interface CreateOrderItemInput {
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  total_price: number
  notes?: string
  addons?: Array<{
    addon_id: string
    quantity?: number
  }>
}

export interface CreateStockItemInput {
  restaurant_id: string
  name: string
  unit: StockUnit
  current_qty?: number
  min_qty?: number
  is_active?: boolean
  notes?: string
}

export interface CreateProductStockRecipeInput {
  restaurant_id: string
  product_id: string
  stock_item_id: string
  quantity: number
}

export interface CreateStockTransactionInput {
  restaurant_id: string
  stock_item_id: string
  type: StockTransactionType
  quantity: number
  previous_qty: number
  new_qty: number
  reason?: string
  order_id?: string
  user_id?: string
}
// </CHANGE>
