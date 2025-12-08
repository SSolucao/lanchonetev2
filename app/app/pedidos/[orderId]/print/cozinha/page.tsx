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

      {/* Kitchen ticket content */}
      <div className="min-h-screen bg-white p-8 print:p-4">
        <div className="max-w-2xl mx-auto font-sans text-black">
          {/* Header */}
          <div className="text-center mb-6 border-b-2 border-black pb-4">
            <h1 className="text-2xl font-bold mb-1">{order.restaurant?.name}</h1>
            <p className="text-lg font-semibold">COMANDA DE COZINHA</p>
          </div>

          {/* Order info */}
          <div className="mb-6 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-4xl font-bold min-w-[60px]">{order.order_number}</span>
              <span className="text-xl font-semibold">{tipoPedidoLabel()}</span>
            </div>
            <p className="text-base">
              {new Date(order.created_at).toLocaleDateString("pt-BR")} às{" "}
              {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>

          {/* Customer info for delivery */}
          {(order.tipo_pedido === "ENTREGA" || order.tipo_pedido === "RETIRADA" || order.channel === "DELIVERY") &&
            order.customer && (
              <div className="mb-6 border-t-2 border-dashed border-gray-400 pt-4">
                <p className="font-bold text-lg mb-1">Cliente: {order.customer.name}</p>
                {(order.tipo_pedido === "ENTREGA" || order.delivery_mode === "ENTREGA") && (
                  <>
                    {order.customer.neighborhood && (
                      <p className="text-base">
                        <strong>Bairro:</strong> {order.customer.neighborhood}
                      </p>
                    )}
                    {order.customer.street && (
                      <p className="text-base">
                        {order.customer.street}
                        {order.customer.number && `, ${order.customer.number}`}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

          {/* Items */}
          <div className="mb-6 border-t-2 border-black pt-4">
            <h3 className="text-xl font-bold mb-4">ITENS DO PEDIDO</h3>
            <div className="space-y-4">
              {order.items?.map((item) => (
                <div key={item.id} className="border-b border-gray-300 pb-3">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl font-bold min-w-[60px]">{item.quantity}x</span>
                    <div className="flex-1">
                      <p className="text-xl font-semibold leading-tight">{item.product_name}</p>
                      {(item as any).product_type === "COMBO" && <p className="text-sm text-gray-600 mt-1">(Combo)</p>}
                      {item.notes && (
                        <p className="text-base mt-2 bg-yellow-100 p-2 rounded">
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
            <div className="mb-6 border-t-2 border-dashed border-gray-400 pt-4">
              <p className="font-bold text-lg mb-2">Observações do pedido:</p>
              <p className="text-base bg-yellow-100 p-3 rounded">{order.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-sm text-gray-600 mt-8 pt-4 border-t border-gray-300">
            <p>Impresso em {new Date().toLocaleString("pt-BR")}</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          @page {
            margin: 0.5cm;
          }
        }
      `}</style>
    </>
  )
}
