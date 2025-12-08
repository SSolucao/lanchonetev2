/**
 * n8n Integration Client
 * Placeholder functions for future n8n workflow integrations
 *
 * Configure the base URL via environment variable: N8N_BASE_URL
 */

const N8N_BASE_URL = process.env.N8N_BASE_URL || "https://webhookn8n.supersolucao.com.br/webhook"

export interface DeliveryFeeCalculationRequest {
  cep_origem: string
  cep_destino: string
}

export interface DeliveryFeeCalculationResponse {
  fee: number
  distance_km: number
  success: boolean
  error?: string
  message?: string
}

/**
 * Calculate delivery fee using n8n workflow
 * This will call an n8n webhook that calculates distance and returns the fee
 */
export async function calculateDeliveryFee(
  request: DeliveryFeeCalculationRequest,
): Promise<DeliveryFeeCalculationResponse> {
  try {
    const response = await fetch(`${N8N_BASE_URL}/calculate-delivery-fee`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`n8n webhook failed: ${response.statusText}`)
    }

    let data = await response.json()

    // If response is an array, get the first item
    if (Array.isArray(data) && data.length > 0) {
      data = data[0]
    }

    return {
      fee: data.fee ?? 0,
      distance_km: data.distance_km ?? 0,
      success: data.success ?? false,
      message: data.message,
      error: data.error,
    }
  } catch (error) {
    console.error("[v0] Error calling n8n calculateDeliveryFee:", error)
    return {
      fee: 0,
      distance_km: 0,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function updateStockOnOrderConfirmed(orderId: string): Promise<void> {
  try {
    const response = await fetch(`${N8N_BASE_URL}/update-stock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ order_id: orderId }),
    })

    if (!response.ok) {
      throw new Error(`n8n webhook failed: ${response.statusText}`)
    }

    console.log("[v0] Stock updated successfully for order", orderId)
  } catch (error) {
    console.error("[v0] Error calling n8n updateStockOnOrderConfirmed:", error)
    // Non-blocking: log the error but don't throw
  }
}

interface UpdateStockRequest {
  restaurantId: string
  orderId: string
  items: Array<{
    productId: string
    quantity: number
  }>
}

/**
 * Update stock when an order is confirmed
 * This will call an n8n workflow that updates stock quantities
 */
export async function updateStockOnOrderConfirmedOld(request: UpdateStockRequest): Promise<void> {
  try {
    const response = await fetch(`${N8N_BASE_URL}/update-stock-old`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`n8n webhook failed: ${response.statusText}`)
    }
  } catch (error) {
    console.error("Error calling n8n updateStockOnOrderConfirmedOld:", error)
  }
}

interface OrderStatusChangeRequest {
  restaurantId: string
  orderId: string
  oldStatus: string
  newStatus: string
  timestamp: string
}

/**
 * Notify n8n when order status changes
 * This can trigger various automations like customer notifications
 */
export async function onOrderStatusChanged(request: OrderStatusChangeRequest): Promise<void> {
  try {
    const response = await fetch(`${N8N_BASE_URL}/order-status-changed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`n8n webhook failed: ${response.statusText}`)
    }
  } catch (error) {
    console.error("Error calling n8n onOrderStatusChanged:", error)
  }
}

interface LowStockAlertRequest {
  restaurantId: string
  products: Array<{
    id: string
    name: string
    currentStock: number
    threshold: number
  }>
}

/**
 * Send low stock alert to n8n
 * This can be called daily to check for products below threshold
 */
export async function sendLowStockAlert(request: LowStockAlertRequest): Promise<void> {
  try {
    const response = await fetch(`${N8N_BASE_URL}/low-stock-alert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`n8n webhook failed: ${response.statusText}`)
    }
  } catch (error) {
    console.error("Error calling n8n sendLowStockAlert:", error)
  }
}

export interface StockUpdateNotification {
  order_id: string
  items: Array<{
    product_id: string
    product_name: string
    quantity: number
  }>
}

/**
 * Notify n8n about stock updates after order confirmation
 */
export async function notifyStockUpdate(notification: StockUpdateNotification): Promise<void> {
  try {
    console.log("[v0] Notifying n8n about stock update:", notification)

    const response = await fetch(`${N8N_BASE_URL}/update-stock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(notification),
    })

    if (!response.ok) {
      throw new Error(`n8n webhook failed: ${response.statusText}`)
    }

    console.log("[v0] Stock update notification sent successfully")
  } catch (error) {
    console.error("[v0] Error notifying stock update to n8n:", error)
    // Non-blocking: log the error but don't throw
  }
}

export interface OrderStatusChangeNotification {
  order_id: string
  order_number: string
  status: string
  channel: string
  total: number
  customer: {
    name: string
    phone?: string
    address?: string
  }
  restaurant: {
    name: string
  }
}

/**
 * Notify n8n when order status changes for customer notifications
 */
export async function notifyOrderStatusChange(order: any, customer: any, restaurant: any): Promise<void> {
  try {
    const notification: OrderStatusChangeNotification = {
      order_id: order.id,
      order_number: order.order_number,
      status: order.status,
      channel: order.channel,
      total: order.total,
      customer: {
        name: customer.name,
        phone: customer.phone || undefined,
        address: customer.street
          ? `${customer.street}, ${customer.number} - ${customer.neighborhood}, ${customer.city}`
          : undefined,
      },
      restaurant: {
        name: restaurant.name,
      },
    }

    console.log("[v0] Notifying n8n about order status change:", notification)

    const response = await fetch(`${N8N_BASE_URL}/order-status-changed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(notification),
    })

    if (!response.ok) {
      throw new Error(`n8n webhook failed: ${response.statusText}`)
    }

    console.log("[v0] Order status change notification sent successfully")
  } catch (error) {
    console.error("[v0] Error notifying order status change to n8n:", error)
    // Non-blocking: log the error but don't throw
  }
}
