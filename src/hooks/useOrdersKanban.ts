"use client"

import { useState, useEffect, useCallback } from "react"
import type { OrderWithDetails } from "@/src/services/ordersService"
import type { OrderChannel, OrderStatus } from "@/src/domain/types"

export interface KanbanFilters {
  channel?: OrderChannel | "ALL"
  period?: "30min" | "today" | "all"
}

export function useOrdersKanban(restaurantId: string) {
  const [orders, setOrders] = useState<OrderWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<KanbanFilters>({
    channel: "ALL",
    period: "today",
  })

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const queryParams = new URLSearchParams()

      // if (filters.channel && filters.channel !== "ALL") {
      //   queryParams.append("channel", filters.channel)
      // }
      if (filters.period) {
        queryParams.append("period", filters.period)
      }

      console.log("[v0] Fetching orders with params:", queryParams.toString())

      const response = await fetch(`/api/orders/kanban?${queryParams.toString()}`)

      console.log("[v0] Kanban API response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.log("[v0] Kanban API error:", errorText)
        throw new Error("Failed to fetch orders")
      }

      const data = await response.json()
      console.log("[v0] Kanban API returned orders:", data.orders?.length || 0)
      console.log("[v0] Orders data:", data.orders)
      setOrders(data.orders || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      console.error("[v0] Error fetching orders for kanban:", err)
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchOrders()

    // Optional: Auto-refresh every 30 seconds
    const interval = setInterval(fetchOrders, 30000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  const updateFilters = (newFilters: Partial<KanbanFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
  }

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const response = await fetch("/api/orders/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, newStatus, restaurantId }),
      })

      if (!response.ok) {
        throw new Error("Failed to update order status")
      }

      // Refresh orders after status change
      await fetchOrders()
      return true
    } catch (err) {
      console.error("[v0] Error updating order status:", err)
      return false
    }
  }

  return {
    orders,
    isLoading,
    error,
    filters,
    updateFilters,
    fetchOrders,
    updateOrderStatus,
  }
}
