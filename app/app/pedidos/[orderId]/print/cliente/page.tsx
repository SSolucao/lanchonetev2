"use client"

import { use, useEffect, useState } from "react"
import type { OrderForPrint } from "@/src/services/ordersService"
import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

interface PageProps {
  params: Promise<{ orderId: string }>
}

export default function CustomerPrintPage({ params }: PageProps) {
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
        body: JSON.stringify({ type: "customer" }),
      })
    } catch (err) {
      console.error("[v0] Error marking customer printed:", err)
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
        return `Comanda ${order.comanda?.numero || ""}`
      default:
        // Fallback for old orders
        if (order.channel === "BALCAO") return "Balcão"
        if (order.delivery_mode === "RETIRA") return "Retirada no balcão"
        return "Entrega"
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
          <div className="text-center mb-4 pb-3 border-b border-black">
            <h1 className="text-xl font-bold uppercase">{order.restaurant?.name}</h1>
            {order.restaurant?.address && <p className="text-[11px]">{order.restaurant.address}</p>}
            <p className="text-xs font-semibold mt-1 tracking-wide">Cupom do Cliente</p>
          </div>

          <div className="mb-3 text-xs space-y-1">
            <p>
              <strong>Pedido:</strong> #{order.order_number}
            </p>
            <p>
              <strong>Data:</strong> {new Date(order.created_at).toLocaleDateString("pt-BR")}{" "}
              {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p>
              <strong>Tipo:</strong> {tipoPedidoLabel()}
            </p>
          </div>

          {(order.tipo_pedido === "ENTREGA" || (order.channel === "DELIVERY" && order.delivery_mode === "ENTREGA")) &&
            order.customer && (
              <div className="mb-3 border-t border-dashed border-gray-400 pt-2 text-xs">
                <p className="font-semibold">Cliente</p>
                <p>{order.customer.name}</p>
                {order.customer.phone && <p>Tel: {order.customer.phone}</p>}
                <div className="mt-1">
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

          <div className="border-t border-black pt-2 space-y-2">
            {order.items?.map((item) => (
              <div key={item.id} className="text-sm pb-1 border-b border-gray-300 last:border-0">
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
                <div className="flex justify-between text-[11px] text-gray-600 pl-4">
                  <span>Unitário</span>
                  <span>
                    R${" "}
                    {item.unit_price.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {item.notes && <p className="text-[11px] text-gray-700 pl-4 mt-1">Obs: {item.notes}</p>}
              </div>
            ))}
          </div>

          <div className="mt-3 border-t-2 border-black pt-2 space-y-1 text-sm">
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
            <div className="flex justify-between font-bold text-lg border-t border-black pt-2 mt-1">
              <span>Total:</span>
              <span>
                R${" "}
                {order.total.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          <div className="mt-2 text-sm">
            <p>
              <strong>Pagamento:</strong> {order.payment_method?.name || "Não informado"}
            </p>
          </div>

          {order.notes && (
            <div className="mt-3 text-sm border-t border-dashed border-gray-400 pt-2">
              <p className="font-semibold">Observações:</p>
              <p>{order.notes}</p>
            </div>
          )}

          <div className="text-center text-[11px] text-gray-600 mt-3 pt-2 border-t border-gray-300">
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
