"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { OrderWithDetails } from "@/src/services/ordersService"
import type { OrderChannel, OrderStatus } from "@/src/domain/types"
import { createClient } from "@/lib/supabase/client"

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

  const fetchOrders = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent
      try {
        if (!silent) {
          setIsLoading(true)
        }
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
        if (!silent) {
          setOrders(data.orders || [])
        } else {
          setOrders((prev) => {
            if (!prev || prev.length === 0) return data.orders || []
            if (!data.orders) return prev
            const map = new Map<string, OrderWithDetails>()
            prev.forEach((o) => map.set(o.id, o))
            data.orders.forEach((o: OrderWithDetails) => map.set(o.id, o))
            return Array.from(map.values())
          })
        }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      console.error("[v0] Error fetching orders for kanban:", err)
    } finally {
        if (!silent) {
          setIsLoading(false)
        }
    }
    },
    [filters],
  )

  useEffect(() => {
    fetchOrders()

    // Auto-refresh como fallback (silencioso)
    const interval = setInterval(() => fetchOrders({ silent: true }), 60000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  // Realtime via Supabase
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  useEffect(() => {
    if (!restaurantId) return
    if (!supabaseRef.current) {
      supabaseRef.current = createClient()
    }
    const supabase = supabaseRef.current

    const channel = supabase
      .channel(`orders-kanban-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          fetchOrders({ silent: true })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId, fetchOrders])

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
