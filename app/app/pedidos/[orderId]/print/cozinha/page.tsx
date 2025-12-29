"use client"

import { use, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import type { OrderForPrint } from "@/src/services/ordersService"

interface PageProps {
  params: Promise<{ orderId: string }>
}

export default function KitchenPrintPage({ params }: PageProps) {
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
      await fetch(`/api/orders/${resolvedParams.orderId}/mark-printed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "kitchen" }),
      })
    } catch (err) {
      console.error("[v0] Error marking kitchen printed:", err)
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
        return "BALCÃO"
      case "RETIRADA":
        return "RETIRADA"
      case "ENTREGA":
        return "ENTREGA"
      case "COMANDA":
        return order.comanda
          ? `COMANDA #${String(order.comanda.numero).padStart(3, "0")} - ${order.comanda.mesa}`
          : "COMANDA"
      default:
        // Fallback for old orders
        if (order.channel === "BALCAO") return "BALCÃO"
        if (order.delivery_mode === "RETIRA") return "RETIRADA"
        return "ENTREGA"
    }
  }

  return (
    <>
      {/* Print controls - hidden when printing */}
      <div className="print:hidden fixed top-4 right-4 flex gap-2 z-50">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Button onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" />
          Imprimir
        </Button>
      </div>

      {/* Thermal label 100x150 content */}
      <div className="min-h-screen bg-white flex justify-center py-6 print:py-0">
        <div className="ticket w-[100mm] max-w-[100mm] font-sans text-black text-sm leading-snug">
          {/* Header */}
          <div className="text-center mb-4 pb-3 border-b border-black">
            <h1 className="text-xl font-bold uppercase">{order.restaurant?.name}</h1>
            <p className="text-xs font-semibold tracking-wide">Comanda de Cozinha</p>
          </div>

          {/* Order summary */}
          <div className="mb-4 flex justify-between items-start">
            <div>
              <p className="text-[32px] font-extrabold leading-none">#{order.order_number}</p>
              <p className="text-xs mt-2">
                {new Date(order.created_at).toLocaleDateString("pt-BR")}{" "}
                {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase text-gray-700">Tipo</p>
              <p className="text-sm font-semibold">{tipoPedidoLabel()}</p>
            </div>
          </div>

          {/* Customer info */}
          {(order.tipo_pedido === "ENTREGA" || order.tipo_pedido === "RETIRADA" || order.channel === "DELIVERY") &&
            order.customer && (
              <div className="mb-4 pt-2 border-t border-dashed border-gray-400">
                <p className="font-semibold text-sm">Cliente</p>
                <p className="text-sm">{order.customer.name}</p>
                {order.customer.neighborhood && (
                  <p className="text-sm">
                    Bairro: <strong>{order.customer.neighborhood}</strong>
                  </p>
                )}
                {order.customer.street && (
                  <p className="text-sm">
                    {order.customer.street}
                    {order.customer.number && `, ${order.customer.number}`}
                  </p>
                )}
              </div>
            )}

          {/* Items */}
          <div className="pt-2 border-t border-black">
            <p className="text-sm font-semibold mb-2 uppercase tracking-wide">Itens do pedido</p>
            <div className="space-y-3">
              {order.items?.map((item) => (
                <div key={item.id} className="pb-2 border-b border-gray-300 last:border-0">
                  <div className="flex items-start gap-2">
                    <span className="text-xl font-extrabold min-w-[36px]">{item.quantity}x</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold leading-tight">{item.product_name}</p>
                      {(item as any).product_type === "COMBO" && <p className="text-[11px] text-gray-600">Combo</p>}
                      {item.addons && item.addons.length > 0 && (
                        <div className="mt-1 space-y-0.5 text-[12px] text-gray-700">
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
                        <p className="text-[12px] mt-1 bg-yellow-100 px-2 py-1 rounded">
                          <strong>Obs:</strong> {item.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order notes */}
          {order.notes && (
            <div className="mt-4 pt-2 border-t border-dashed border-gray-400">
              <p className="text-sm font-semibold mb-1">Observações do pedido</p>
              <p className="text-[12px] bg-yellow-100 px-2 py-1 rounded">{order.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-[11px] text-gray-600 mt-4 pt-2 border-t border-gray-300">
            <p>Impresso em {new Date().toLocaleString("pt-BR")}</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          @page {
            margin: 3mm;
            size: 100mm 150mm;
          }
          .ticket {
            width: 100mm !important;
            max-width: 100mm !important;
          }
        }
      `}</style>
    </>
  )
}
