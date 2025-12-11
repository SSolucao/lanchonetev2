"use client"

import { useState } from "react"
import { useAuth } from "@/src/context/AuthContext"
import { useOrdersKanban } from "@/src/hooks/useOrdersKanban"
import { useOrderNotifications } from "@/src/hooks/useOrderNotifications"
import { OrderNotificationControl } from "@/src/components/OrderNotificationControl"
import { OrderCard } from "@/src/components/OrderCard"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw, Loader2 } from "lucide-react"
import type { OrderStatus, OrderChannel } from "@/src/domain/types"

const STATUS_COLUMNS: Array<{ key: OrderStatus; label: string; color: string }> = [
  { key: "NOVO", label: "Novo", color: "bg-blue-100 dark:bg-blue-950" },
  { key: "EM_PREPARO", label: "Em preparo", color: "bg-yellow-100 dark:bg-yellow-950" },
  { key: "SAIU_PARA_ENTREGA", label: "Saiu para entrega", color: "bg-purple-100 dark:bg-purple-950" },
  { key: "FINALIZADO", label: "Finalizado", color: "bg-green-100 dark:bg-green-950" },
  // Coluna cancelado ocultada para reduzir poluição visual
  // { key: "CANCELADO", label: "Cancelado", color: "bg-red-100 dark:bg-red-950" },
]

export default function PedidosPage() {
  const { currentUser } = useAuth()
  const { orders, isLoading, filters, updateFilters, fetchOrders, updateOrderStatus } = useOrdersKanban(
    currentUser?.restaurant_id || "",
  )

  const notifications = useOrderNotifications(currentUser?.restaurant_id || "")

  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchOrders()
    setIsRefreshing(false)
    notifications.clearNotifications()
  }

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    await updateOrderStatus(orderId, newStatus)
  }

  const ordersByStatus = STATUS_COLUMNS.map((col) => ({
    ...col,
    orders: orders.filter((order) => order.status === col.key),
  }))

  const isKitchenView = currentUser?.role === "KITCHEN"

  return (
    <div className={isKitchenView ? "min-h-screen p-6 bg-background" : "space-y-6"}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pedidos</h1>
          <p className="text-muted-foreground mt-1">Kanban de pedidos em tempo real</p>
        </div>

        <div className="flex items-center gap-2">
          <OrderNotificationControl
            enabled={notifications.enabled}
            volume={notifications.volume}
            newOrdersCount={notifications.newOrdersCount}
            onToggle={notifications.toggleEnabled}
            onVolumeChange={notifications.setVolume}
            onTest={notifications.testSound}
          />

          <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center bg-muted/50 p-4 rounded-lg">
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">Canal</label>
          <Select
            value={filters.channel || "ALL"}
            onValueChange={(value) => updateFilters({ channel: value as OrderChannel | "ALL" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="BALCAO">Balcão</SelectItem>
              <SelectItem value="DELIVERY">Delivery</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">Período</label>
          <Select
            value={filters.period || "today"}
            onValueChange={(value) => updateFilters({ period: value as "30min" | "today" | "all" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30min">Últimos 30 minutos</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {ordersByStatus.map((column) => (
            <div key={column.key} className="space-y-3">
              <div className={`${column.color} p-3 rounded-lg`}>
                <h3 className="font-semibold text-sm flex items-center justify-between">
                  <span>{column.label}</span>
                  <span className="bg-background/80 px-2 py-1 rounded-full text-xs">{column.orders.length}</span>
                </h3>
              </div>

              <div className="space-y-3">
                {column.orders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">Nenhum pedido</div>
                ) : (
                  column.orders.map((order) => (
                    <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
