"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Printer } from "lucide-react"
import type { OrderForPrint } from "@/src/services/ordersService"
import { Button } from "@/components/ui/button"

interface PageProps {
  params: Promise<{ orderId: string }>
}

export default function DualPrintPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [order, setOrder] = useState<OrderForPrint | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadOrder() {
      try {
        const response = await fetch(`/api/orders/${resolvedParams.orderId}/print-data`)
        if (!response.ok) {
          setError("Pedido não encontrado")
          return
        }
        const data = await response.json()
        setOrder(data.order)
      } catch (err) {
        console.error("[v0] Error loading order for print:", err)
        setError("Erro ao carregar pedido")
      } finally {
        setIsLoading(false)
      }
    }
    loadOrder()
  }, [resolvedParams.orderId])

  const handlePrint = async () => {
    window.print()
    try {
      await Promise.all([
        fetch(`/api/orders/${resolvedParams.orderId}/mark-printed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "kitchen" }),
        }),
        fetch(`/api/orders/${resolvedParams.orderId}/mark-printed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "customer" }),
        }),
      ])
    } catch (err) {
      console.error("[v0] Error marking prints:", err)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive">{error || "Pedido não encontrado"}</p>
        <Button onClick={() => router.back()}>Voltar</Button>
      </div>
    )
  }

  const tipoPedidoLabel = () => {
    switch (order.tipo_pedido) {
      case "BALCAO":
        return "Balcão"
      case "RETIRADA":
        return "Retirada"
      case "ENTREGA":
        return "Entrega"
      case "COMANDA":
        return order.comanda ? `Comanda #${String(order.comanda.numero).padStart(3, "0")}` : "Comanda"
      default:
        if (order.channel === "BALCAO") return "Balcão"
        if (order.delivery_mode === "RETIRA") return "Retirada"
        return "Entrega"
    }
  }

  return (
    <>
      <div className="print:hidden fixed top-4 right-4 flex gap-2 z-50">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Button onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" />
          Imprimir 2 vias
        </Button>
      </div>

      <div className="min-h-screen bg-white p-8 print:p-4">
        <div className="max-w-3xl mx-auto font-sans text-black space-y-10">
          {/* Via cozinha */}
          <section className="border border-black">
            <div className="text-center mb-4 border-b-2 border-black p-4 pb-3">
              <h1 className="text-2xl font-bold mb-1">{order.restaurant?.name}</h1>
              <p className="text-lg font-semibold">COMANDA DE COZINHA</p>
            </div>

            <div className="px-6 pb-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-700">Pedido</p>
                  <p className="text-4xl font-bold leading-none">#{order.order_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-700">Tipo</p>
                  <p className="text-xl font-semibold">{tipoPedidoLabel()}</p>
                </div>
              </div>

              <p className="text-sm">
                {new Date(order.created_at).toLocaleDateString("pt-BR")} às{" "}
                {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>

              {(order.tipo_pedido === "ENTREGA" || order.tipo_pedido === "RETIRADA" || order.channel === "DELIVERY") &&
                order.customer && (
                  <div className="border-t border-dashed border-gray-400 pt-3 text-sm">
                    <p className="font-bold mb-1">Cliente: {order.customer.name}</p>
                    {order.tipo_pedido !== "RETIRADA" && order.customer.street && (
                      <p>
                        {order.customer.street}
                        {order.customer.number && `, ${order.customer.number}`}
                        {order.customer.neighborhood && ` - ${order.customer.neighborhood}`}
                      </p>
                    )}
                  </div>
                )}

              <div className="border-t-2 border-black pt-4 space-y-3">
                <h3 className="text-lg font-bold">Itens</h3>
                <div className="space-y-3">
                {order.items?.map((item) => (
                  <div key={item.id} className="border-b border-gray-200 pb-2">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl font-bold min-w-[50px]">{item.quantity}x</span>
                      <div className="flex-1">
                        <p className="text-lg font-semibold leading-tight">{item.product_name}</p>
                        {(item as any).product_type === "COMBO" && (
                          <p className="text-xs text-gray-600 mt-1">Combo</p>
                        )}
                        {item.addons && item.addons.length > 0 && (
                          <div className="mt-2 space-y-1 text-sm text-gray-700">
                            {item.addons.map((ad: any) => (
                              <div key={ad.id} className="flex justify-between pl-6">
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
                        {item.notes && (
                          <p className="text-sm mt-2 bg-yellow-100 p-2 rounded">
                            <strong>Obs:</strong> {item.notes}
                          </p>
                        )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {order.notes && (
                <div className="border-t border-dashed border-gray-400 pt-3">
                  <p className="font-bold mb-2">Observações do pedido:</p>
                  <p className="text-sm bg-yellow-100 p-3 rounded">{order.notes}</p>
                </div>
              )}
            </div>
          </section>

          <div className="page-break" />

          {/* Via balcão/cliente */}
          <section className="border border-black">
            <div className="text-center mb-4 border-b-2 border-black p-4 pb-3">
              <h1 className="text-xl font-bold mb-1">{order.restaurant?.name}</h1>
              {order.restaurant?.address && <p className="text-xs text-gray-700">{order.restaurant.address}</p>}
              <p className="text-lg font-semibold mt-2">CUPOM DE BALCÃO</p>
            </div>

            <div className="px-6 pb-6 space-y-4 text-sm">
              <div className="space-y-1">
                <p>
                  <strong>Pedido:</strong> #{order.order_number}
                </p>
                <p>
                  <strong>Data:</strong> {new Date(order.created_at).toLocaleDateString("pt-BR")} às{" "}
                  {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p>
                  <strong>Tipo:</strong> {tipoPedidoLabel()}
                </p>
              </div>

              {(order.tipo_pedido === "ENTREGA" ||
                (order.channel === "DELIVERY" && order.delivery_mode === "ENTREGA")) &&
                order.customer && (
                  <div className="border-t border-dashed border-gray-400 pt-3">
                    <p className="font-bold mb-1">Cliente</p>
                    <p>{order.customer.name}</p>
                    {order.customer.phone && <p>Tel: {order.customer.phone}</p>}
                    <div className="mt-2">
                      {order.customer.street && (
                        <p>
                          {order.customer.street}
                          {order.customer.number && `, ${order.customer.number}`}
                        </p>
                      )}
                      {order.customer.neighborhood && <p>{order.customer.neighborhood}</p>}
                      {order.customer.city && <p>{order.customer.city}</p>}
                      {order.customer.cep && <p>CEP: {order.customer.cep}</p>}
                    </div>
                  </div>
                )}

              <div className="border-t border-black pt-3 space-y-2">
                {order.items?.map((item) => (
                  <div key={item.id} className="text-sm">
                    <div className="flex justify-between">
                      <span>
                        {item.quantity}x {item.product_name}
                      </span>
                      <span>
                        R${" "}
                        {item.total_price.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    {item.addons && item.addons.length > 0 && (
                      <div className="mt-1 space-y-0.5 text-xs text-gray-700">
                        {item.addons.map((ad: any) => (
                          <div key={ad.id} className="flex justify-between pl-4">
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
                    <div className="flex justify-between text-xs text-gray-600 pl-4">
                      <span>Unitário</span>
                      <span>
                        R${" "}
                        {item.unit_price.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    {item.notes && <p className="text-xs text-gray-600 pl-4 mt-1">Obs: {item.notes}</p>}
                  </div>
                ))}
              </div>

              <div className="border-t-2 border-black pt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>
                    R${" "}
                    {order.subtotal.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {order.delivery_fee > 0 && (
                  <div className="flex justify-between">
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
                <div className="flex justify-between font-bold text-lg border-t border-black pt-2 mt-2">
                  <span>TOTAL:</span>
                  <span>
                    R${" "}
                    {order.total.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              <div className="text-sm">
                <p>
                  <strong>Pagamento:</strong> {order.payment_method?.name || "Não informado"}
                </p>
              </div>

              {order.notes && (
                <div className="text-sm border-t border-dashed border-gray-400 pt-3">
                  <p className="font-bold mb-1">Observações:</p>
                  <p>{order.notes}</p>
                </div>
              )}

              <div className="text-center text-xs text-gray-600 pt-4 border-t border-gray-300">
                <p>Impresso em {new Date().toLocaleString("pt-BR")}</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .page-break {
            page-break-after: always;
          }
          @page {
            margin: 0.5cm;
          }
        }
      `}</style>
    </>
  )
}
