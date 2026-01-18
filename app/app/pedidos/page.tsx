"use client"

import { useState } from "react"
import { useAuth } from "@/src/context/AuthContext"
import { useOrdersKanban } from "@/src/hooks/useOrdersKanban"
import { useOrderNotifications } from "@/src/hooks/useOrderNotifications"
import { OrderNotificationControl } from "@/src/components/OrderNotificationControl"
import { OrderCard } from "@/src/components/OrderCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw, Loader2, Search } from "lucide-react"
import type { OrderStatus, OrderChannel } from "@/src/domain/types"

const STATUS_COLUMNS: Array<{ key: OrderStatus; label: string; color: string }> = [
  { key: "NOVO", label: "Em análise", color: "bg-blue-200 dark:bg-blue-900/80" },
  { key: "EM_PREPARO", label: "Em produção", color: "bg-yellow-200 dark:bg-yellow-900/80" },
  { key: "SAIU_PARA_ENTREGA", label: "Pronto para entrega", color: "bg-purple-200 dark:bg-purple-900/80" },
  { key: "FINALIZADO", label: "Finalizado", color: "bg-green-200 dark:bg-green-900/80" },
]

export default function PedidosPage() {
  const { currentUser } = useAuth()
  const { orders, isLoading, filters, updateFilters, fetchOrders, updateOrderStatus } = useOrdersKanban(
    currentUser?.restaurant_id || "",
  )

  const notifications = useOrderNotifications(currentUser?.restaurant_id || "")

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchNumber, setSearchNumber] = useState("")
  const [searchCustomer, setSearchCustomer] = useState("")

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchOrders()
    setIsRefreshing(false)
    notifications.clearNotifications()
  }

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    await updateOrderStatus(orderId, newStatus)
  }

  const filteredOrders = orders.filter((order) => {
    const matchesNumber = searchNumber
      ? String(order.order_number || "").toLowerCase().includes(searchNumber.toLowerCase().trim())
      : true
    const matchesCustomer = searchCustomer
      ? (order.customer?.name || "").toLowerCase().includes(searchCustomer.toLowerCase().trim())
      : true
    return matchesNumber && matchesCustomer
  })

  const ordersByStatus = STATUS_COLUMNS.map((col) => ({
    ...col,
    orders: filteredOrders.filter((order) => order.status === col.key),
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

      {/* Filtros e buscas */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 bg-muted/50 p-4 rounded-lg">
        <div className="space-y-2">
          <label className="text-sm font-medium block">Canal</label>
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

        <div className="space-y-2">
          <label className="text-sm font-medium block">Período</label>
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

        <div className="space-y-2">
          <label className="text-sm font-medium block">Nº do pedido</label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Ex: 123"
              value={searchNumber}
              onChange={(e) => setSearchNumber(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium block">Cliente</label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome"
              value={searchCustomer}
              onChange={(e) => setSearchCustomer(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {ordersByStatus.map((column) => (
            <div key={column.key} className="flex flex-col min-h-[65vh] rounded-lg border overflow-hidden bg-card">
              <div className={`${column.color} px-4 py-2.5 flex items-center justify-between`}>
                <h3 className="font-semibold text-sm">{column.label}</h3>
                <span className="bg-background/90 px-2 py-1 rounded-full text-xs">{column.orders.length}</span>
              </div>

              <div className="flex-1 bg-muted/10 p-4 space-y-3 flex flex-col">
                {column.orders.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-center text-muted-foreground text-sm">
                    Nenhum pedido no momento.
                  </div>
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
