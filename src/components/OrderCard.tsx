"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { MoreVertical, Clock, Phone } from "lucide-react"
import type { OrderWithDetails } from "@/src/services/ordersService"
import type { OrderStatus } from "@/src/domain/types"

interface OrderCardProps {
  order: OrderWithDetails
  onStatusChange: (orderId: string, newStatus: OrderStatus) => Promise<void>
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  NOVO: "bg-blue-500",
  EM_PREPARO: "bg-yellow-500",
  SAIU_PARA_ENTREGA: "bg-purple-500",
  FINALIZADO: "bg-green-500",
  CANCELADO: "bg-red-500",
}

function getAvailableTransitions(currentStatus: OrderStatus, isDelivery: boolean): OrderStatus[] {
  switch (currentStatus) {
    case "NOVO":
      return ["EM_PREPARO", "CANCELADO"]
    case "EM_PREPARO":
      if (isDelivery) {
        return ["SAIU_PARA_ENTREGA", "FINALIZADO", "CANCELADO"]
      }
      return ["FINALIZADO", "CANCELADO"]
    case "SAIU_PARA_ENTREGA":
      return ["FINALIZADO", "CANCELADO"]
    case "FINALIZADO":
    case "CANCELADO":
      return []
    default:
      return []
  }
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  NOVO: "Em análise",
  EM_PREPARO: "Em produção",
  SAIU_PARA_ENTREGA: "Pronto para entrega",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado",
}

export function OrderCard({ order, onStatusChange }: OrderCardProps) {
  const [isChangingStatus, setIsChangingStatus] = useState(false)

  const tipoPedidoLabel = () => {
    switch (order.tipo_pedido) {
      case "BALCAO":
        return "Consumo"
      case "RETIRADA":
        return "Retirada"
      case "ENTREGA":
        return "Entrega"
      case "COMANDA":
        return order.comanda
          ? `Comanda #${String(order.comanda.numero).padStart(3, "0")} - ${order.comanda.mesa}`
          : "Comanda"
      default:
        // Fallback for old orders
        if (order.channel === "BALCAO") return "Consumo"
        if (order.delivery_mode === "RETIRA") return "Retirada"
        return "Entrega"
    }
  }

  const isEntrega =
    order.tipo_pedido === "ENTREGA" || (order.channel === "DELIVERY" && order.delivery_mode === "ENTREGA")
  const availableTransitions = getAvailableTransitions(order.status, isEntrega)

  const handleStatusChange = async (newStatus: OrderStatus) => {
    setIsChangingStatus(true)
    try {
      await onStatusChange(order.id, newStatus)
    } finally {
      setIsChangingStatus(false)
    }
  }

  const customerName = order.customer?.name || "Cliente não identificado"

  const timeAgo = formatDistanceToNow(new Date(order.created_at), {
    addSuffix: false,
    locale: ptBR,
  })

  const itemsSummary = order.items
    ?.slice(0, 3)
    .map((item) => `${item.quantity}x ${item.product_name}`)
    .join(", ")

  const hasMoreItems = (order.items?.length || 0) > 3

  return (
    <Card className="mb-3">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold">#{order.order_number}</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {tipoPedidoLabel()}
            </Badge>
          </div>

          {availableTransitions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={isChangingStatus}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {availableTransitions.map((status) => (
                  <DropdownMenuItem key={status} onClick={() => handleStatusChange(status)}>
                    Mover para: {STATUS_LABELS[status]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          <span className="ml-2">+{timeAgo}</span>
        </div>

        <div className="text-sm">
          <strong>{customerName}</strong>
          {order.customer?.phone && (
            <div className="flex items-center gap-1 text-muted-foreground mt-1">
              <Phone className="h-3 w-3" />
              <span>{order.customer.phone}</span>
            </div>
          )}
        </div>

        <div
          className="text-sm text-muted-foreground"
          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
        >
          {itemsSummary}
          {hasMoreItems && "..."}
        </div>

        <div className="flex items-center justify-between pt-2 border-t gap-2 flex-wrap">
          <span className="font-semibold text-lg">
            R$ {order.total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>

          <div className="flex items-center gap-2">
            {order.status === "SAIU_PARA_ENTREGA" && (
              <Button
                size="sm"
                variant="default"
                className="min-w-[96px]"
                onClick={() => handleStatusChange("FINALIZADO")}
                disabled={isChangingStatus}
              >
                Finalizar
              </Button>
            )}

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="min-w-[108px]">
                  Ver detalhes
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Pedido #{order.order_number}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                  <div>
                    <h4 className="font-semibold mb-2">Informações</h4>
                    <div className="space-y-1 text-sm">
                      <p>
                        <strong>Tipo:</strong> {tipoPedidoLabel()}
                      </p>
                      <p>
                        <strong>Cliente:</strong> {customerName}
                      </p>
                      {order.customer?.phone && (
                        <p>
                          <strong>Telefone:</strong> {order.customer.phone}
                        </p>
                      )}
                      <p>
                        <strong>Status:</strong> {STATUS_LABELS[order.status]}
                      </p>
                      <p>
                        <strong>Forma de pagamento:</strong> {order.payment_method?.name || "Não informado"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Itens</h4>
                    <div className="space-y-2">
                      {order.items?.map((item) => (
                        <div key={item.id} className="text-sm border-b pb-2">
                          <div className="flex justify-between gap-2">
                            <div>
                              <p>
                                <strong>
                                  {item.quantity}x {item.product_name}
                                </strong>
                              </p>
                              {item.notes && <p className="text-muted-foreground text-xs">Obs: {item.notes}</p>}
                            </div>
                            <p className="font-semibold">
                              R${" "}
                              {item.total_price.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {item.addons && item.addons.length > 0 && (
                            <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                              {item.addons.map((ad) => (
                                <div key={ad.id} className="flex justify-between gap-2">
                                  <span>
                                    {ad.quantity}x {ad.name}
                                  </span>
                                  <span>
                                    R${" "}
                                    {(Number(ad.price) * Number(ad.quantity)).toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Subtotal:</span>
                      <span>
                        R${" "}
                        {order.subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {order.delivery_fee > 0 && (
                      <div className="flex justify-between text-sm mb-1">
                        <span>Taxa de entrega:</span>
                        <span>
                          R${" "}
                          {order.delivery_fee.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Total:</span>
                      <span>
                        R$ {order.total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {order.notes && (
                    <div>
                      <h4 className="font-semibold mb-1">Observações do pedido</h4>
                      <p className="text-sm text-muted-foreground">{order.notes}</p>
                    </div>
                  )}

                  <div className="border-t pt-4 space-y-2">
                    <h4 className="font-semibold mb-2">Impressão</h4>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 bg-transparent"
                        onClick={() => window.open(`/app/pedidos/${order.id}/print/cozinha`, "_blank")}
                      >
                        Imprimir cozinha
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 bg-transparent"
                        onClick={() => window.open(`/app/pedidos/${order.id}/print/cliente`, "_blank")}
                      >
                        Imprimir cliente
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1 mt-2">
                      {order.kitchen_printed_at && (
                        <p>
                          Cozinha impresso em:{" "}
                          {new Date(order.kitchen_printed_at).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                      )}
                      {order.customer_printed_at && (
                        <p>
                          Cliente impresso em:{" "}
                          {new Date(order.customer_printed_at).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
