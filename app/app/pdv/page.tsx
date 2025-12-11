"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { usePdvOrder } from "@/src/hooks/usePdvOrder"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Search, Plus, Minus, Trash2, Calculator, CheckCircle } from "lucide-react"
import type { Product, PaymentMethod, Customer, Restaurant } from "@/src/domain/types"
import { formatPhone, formatCEP, unformatNumbers, fetchAddressFromCEP } from "@/lib/format-utils"
import { CustomerFormDialog } from "@/src/components/CustomerFormDialog"

export default function PdvPage() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const comandaId = searchParams.get("comanda_id")

  const {
    draft,
    addItem,
    removeItem,
    updateItemQuantity,
    updateItemNotes,
    setTipoPedido,
    setCustomer,
    setDeliveryFee,
    setPaymentMethod,
    setNotes,
    clearDraft,
    subtotal,
    total,
  } = usePdvOrder()

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [customerSearchTerm, setCustomerSearchTerm] = useState("")
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([])
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)
  const [isCalculatingFee, setIsCalculatingFee] = useState(false)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [loadingCEP, setLoadingCEP] = useState(false)
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)
  const [createdOrderNumber, setCreatedOrderNumber] = useState<number | null>(null)
  const [comanda, setComanda] = useState<any>(null)

  const [newCustomerData, setNewCustomerData] = useState({
    name: "",
    phone: "",
    cep: "",
    street: "",
    number: "",
    neighborhood: "",
    city: "",
    complement: "",
  })

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch("/api/pdv/initial-data")
        if (!response.ok) {
          throw new Error("Failed to fetch initial data")
        }

        const data = await response.json()
        setRestaurant(data.restaurant)
        setProducts(data.products)
        setPaymentMethods(data.paymentMethods)
      } catch (error) {
        console.error("[v0] Error loading PDV data:", error)
        toast({
          variant: "destructive",
          title: "Erro ao carregar dados",
          description: "Não foi possível carregar os dados iniciais.",
        })
      }
    }
    loadData()
  }, [toast])

  useEffect(() => {
    if (comandaId) {
      fetchComandaDetails(comandaId)
    }
  }, [comandaId])

  const fetchComandaDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/comandas/${id}`)
      if (res.ok) {
        const data = await res.json()
        setComanda(data)
        setTipoPedido("COMANDA")
        if (data.customer) {
          setCustomer(data.customer)
        }
      }
    } catch (error) {
      console.error("Error fetching comanda:", error)
      toast({
        title: "Erro",
        description: "Não foi possível carregar a comanda",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    if (!customerSearchTerm || customerSearchTerm.trim().length < 2) {
      setCustomerSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        if (!restaurant) return
        const results = await fetch(
          `/api/customers/search?restaurantId=${restaurant.id}&searchTerm=${customerSearchTerm}`,
        ).then((response) => response.json())
        setCustomerSearchResults(results)
      } catch (error) {
        console.error("[v0] Error searching customers:", error)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [customerSearchTerm, restaurant])

  const filteredProducts = products.filter(
    (product) => searchTerm.trim() === "" || product.name.toLowerCase().includes(searchTerm.toLowerCase().trim()),
  )

  const handleCalculateDeliveryFee = useCallback(async () => {
    if (!restaurant || !draft.customer?.cep) {
      toast({
        variant: "destructive",
        title: "Dados incompletos",
        description: "Selecione um cliente com CEP para calcular a taxa.",
      })
      return
    }

    setIsCalculatingFee(true)
    try {
      const response = await fetch("/api/delivery/fee", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cep_origem: restaurant.cep_origem,
          cep_destino: draft.customer.cep,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setDeliveryFee(result.fee)
        toast({
          title: "Taxa calculada",
          description: `Taxa de entrega: R$ ${result.fee.toFixed(2)} (${result.distance_km.toFixed(1)} km)`,
        })
      } else {
        setDeliveryFee(result.fee || 0)

        let description = result.message || "Não foi possível calcular a taxa. Preencha manualmente."

        if (result.distance_km > 0) {
          description = `Distância: ${result.distance_km.toFixed(1)} km. ${description}`
        }

        toast({
          variant: "destructive",
          title: "Falha no cálculo",
          description,
        })
      }
    } catch (error) {
      console.error("[v0] Error calculating delivery fee:", error)
      toast({
        variant: "destructive",
        title: "Erro ao calcular taxa",
        description: "Preencha a taxa manualmente.",
      })
    } finally {
      setIsCalculatingFee(false)
    }
  }, [restaurant, draft.customer, setDeliveryFee, toast])

  async function handleNewCustomerCEPChange(value: string) {
    const formatted = formatCEP(value)
    setNewCustomerData((prev) => ({ ...prev, cep: formatted }))

    const cleanCEP = unformatNumbers(formatted)
    if (cleanCEP.length === 8) {
      setLoadingCEP(true)
      const addressData = await fetchAddressFromCEP(cleanCEP)
      setLoadingCEP(false)

      if (addressData) {
        setNewCustomerData((prev) => ({
          ...prev,
          street: addressData.logradouro,
          neighborhood: addressData.bairro,
          city: addressData.localidade,
          complement: prev.complement || addressData.complemento,
        }))
      }
    }
  }

  const handleCreateCustomer = useCallback(async () => {
    if (!restaurant) return
    if (!newCustomerData.name || !newCustomerData.phone) {
      toast({
        variant: "destructive",
        title: "Dados incompletos",
        description: "Nome e telefone são obrigatórios.",
      })
      return
    }

    try {
      const response = await fetch("/api/customers/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          name: newCustomerData.name,
          phone: unformatNumbers(newCustomerData.phone),
          cep: newCustomerData.cep ? unformatNumbers(newCustomerData.cep) : undefined,
          street: newCustomerData.street || undefined,
          number: newCustomerData.number || undefined,
          neighborhood: newCustomerData.neighborhood || undefined,
          city: newCustomerData.city || undefined,
          complement: newCustomerData.complement || undefined,
        }),
      })

      const customer = await response.json()

      setCustomer(customer)
      setShowNewCustomerForm(false)
      setNewCustomerData({
        name: "",
        phone: "",
        cep: "",
        street: "",
        number: "",
        neighborhood: "",
        city: "",
        complement: "",
      })
      setCustomerSearchTerm("")

      toast({
        title: "Cliente cadastrado",
        description: `${customer.name} foi cadastrado com sucesso.`,
      })
    } catch (error) {
      console.error("[v0] Error creating customer:", error)
      toast({
        variant: "destructive",
        title: "Erro ao cadastrar cliente",
        description: "Não foi possível cadastrar o cliente.",
      })
    }
  }, [restaurant, newCustomerData, setCustomer, toast])

  const handleConfirmOrder = useCallback(async () => {
    if (!restaurant) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Restaurante não carregado.",
      })
      return
    }

    if (draft.items.length === 0) {
      toast({
        variant: "destructive",
        title: "Pedido vazio",
        description: "Adicione pelo menos um item ao pedido.",
      })
      return
    }

    if (!draft.customer) {
      toast({
        variant: "destructive",
        title: "Cliente obrigatório",
        description: "Selecione ou cadastre um cliente.",
      })
      return
    }

    if (!draft.paymentMethodId) {
      toast({
        variant: "destructive",
        title: "Forma de pagamento",
        description: "Selecione uma forma de pagamento.",
      })
      return
    }

    setIsCreatingOrder(true)
    try {
      const responseOrderNumber = await fetch(`/api/orders/next-number?restaurantId=${restaurant.id}`)
      const orderNumber = await responseOrderNumber.json()

      const orderInput = {
        restaurant_id: restaurant.id,
        order_number: orderNumber,
        tipo_pedido: draft.tipoPedido,
        customer_id: draft.customer?.id,
        comanda_id: comandaId || undefined,
        subtotal,
        delivery_fee: draft.deliveryFee,
        total,
        payment_method_id: draft.paymentMethodId,
        payment_status: "PAGO" as const,
        status: "NOVO" as const,
        notes: draft.notes,
      }

      const itemsInput = draft.items.map((item) => ({
        order_id: "",
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        total_price: item.product.price * item.quantity,
        notes: item.notes || undefined,
      }))

      const responseCreateOrder = await fetch("/api/orders/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderInput, itemsInput }),
      })

      const { order } = await responseCreateOrder.json()

      await fetch(`/api/orders/update-stock?orderId=${order.id}`, {
        method: "POST",
      })

      setCreatedOrderId(order.id)
      setCreatedOrderNumber(order.order_number)

      clearDraft()
      toast({
        title: "Pedido criado",
        description: `Pedido #${order.order_number} criado com sucesso!`,
      })

      if (comandaId) {
        setTimeout(() => {
          window.location.href = "/app/comandas"
        }, 2000)
      }
    } catch (error) {
      console.error("Error creating order:", error)
      toast({
        variant: "destructive",
        title: "Erro ao criar pedido",
        description: error instanceof Error ? error.message : "Tente novamente.",
      })
    } finally {
      setIsCreatingOrder(false)
    }
  }, [restaurant, draft, subtotal, total, clearDraft, toast, comandaId])

  const handleNewOrder = () => {
    setCreatedOrderId(null)
    setCreatedOrderNumber(null)
  }

  const isEntrega = draft.tipoPedido === "ENTREGA"

  // Sempre que seleciona cliente ou muda para entrega, aplica taxa padrão do cliente
  useEffect(() => {
    if (isEntrega && draft.customer) {
      setDeliveryFee(draft.customer.delivery_fee_default || 0)
    }
  }, [isEntrega, draft.customer, setDeliveryFee])

  return (
    <>
      <div className="container mx-auto max-w-7xl px-6 py-6">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <Card>
            <CardHeader>
              <CardTitle>
                {comanda ? (
                  <div className="space-y-1">
                    <div className="text-2xl font-bold">PDV - Adicionar à Comanda</div>
                    <div className="text-sm font-normal text-muted-foreground">
                      Comanda #{String(comanda.numero).padStart(3, "0")} - {comanda.mesa}
                    </div>
                  </div>
                ) : (
                  "PDV - Novo Pedido"
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {filteredProducts.map((product) => (
                  <Card
                    key={product.id}
                    className="cursor-pointer transition-colors hover:bg-accent"
                    onClick={() => addItem(product)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{product.name}</h3>
                            {product.type === "COMBO" && (
                              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                Combo
                              </span>
                            )}
                          </div>
                          {product.category && <p className="text-sm text-muted-foreground">{product.category}</p>}
                        </div>
                        <p className="text-lg font-semibold">R$ {product.price.toFixed(2)}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="w-full lg:w-[360px] shrink-0">
          {createdOrderId && createdOrderNumber ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-center">Pedido criado com sucesso!</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-4">
                  <p className="text-5xl font-bold text-green-600 mb-2">#{createdOrderNumber}</p>
                  <p className="text-muted-foreground">Pedido registrado no sistema</p>
                </div>

                <div className="space-y-3">
                  <Button
                    className="w-full bg-transparent"
                    size="lg"
                    variant="outline"
                    onClick={() => window.open(`/app/pedidos/${createdOrderId}/print/duas-vias`, "_blank")}
                  >
                    Imprimir 2 vias (cozinha + balcão)
                  </Button>

                  <Button
                    className="w-full bg-transparent"
                    size="lg"
                    variant="outline"
                    onClick={async () => {
                      if (!createdOrderId) return
                      try {
                        const res = await fetch(`/api/orders/${createdOrderId}/print-pdf`)
                        if (!res.ok) throw new Error("Falha ao gerar PDF")
                        const blob = await res.blob()
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement("a")
                        a.href = url
                        a.download = `pedido-${createdOrderId}.pdf`
                        a.click()
                        URL.revokeObjectURL(url)
                      } catch (err) {
                        console.error("Erro ao baixar PDF:", err)
                      }
                    }}
                  >
                    Baixar PDF (2 vias)
                  </Button>

                  <Button
                    className="w-full bg-transparent"
                    size="lg"
                    variant="outline"
                    onClick={() => window.open(`/app/pedidos/${createdOrderId}/print/cozinha`, "_blank")}
                  >
                    Imprimir cozinha
                  </Button>

                  <Button
                    className="w-full bg-transparent"
                    size="lg"
                    variant="outline"
                    onClick={() => window.open(`/app/pedidos/${createdOrderId}/print/cliente`, "_blank")}
                  >
                    Imprimir cliente
                  </Button>

                  <Button className="w-full" size="lg" onClick={handleNewOrder}>
                    Novo pedido
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Pedido em montagem</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {draft.items.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Nenhum item adicionado</p>
                ) : (
                  <div className="space-y-3">
                    {draft.items.map((item) => (
                      <Card key={item.product.id}>
                        <CardContent className="space-y-2 p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium">{item.product.name}</h4>
                              <p className="text-sm text-muted-foreground">R$ {item.product.price.toFixed(2)} un.</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removeItem(item.product.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 bg-transparent"
                              onClick={() => updateItemQuantity(item.product.id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-12 text-center font-medium">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 bg-transparent"
                              onClick={() => updateItemQuantity(item.product.id, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <span className="ml-auto font-semibold">
                              R$ {(item.product.price * item.quantity).toFixed(2)}
                            </span>
                          </div>

                          <Input
                            placeholder="Observação (ex: sem cebola)"
                            value={item.notes}
                            onChange={(e) => updateItemNotes(item.product.id, e.target.value)}
                            className="text-sm"
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="border-t pt-3">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Subtotal:</span>
                    <span>R$ {subtotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-2 border-t pt-3">
                  <Label>Tipo de Pedido</Label>
                  {comandaId ? (
                    <div className="p-3 bg-muted rounded-md text-sm">
                      Tipo: <strong>Comanda</strong> (pedido vinculado à comanda)
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant={draft.tipoPedido === "BALCAO" ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setTipoPedido("BALCAO")}
                      >
                        Balcão
                      </Button>
                      <Button
                        variant={draft.tipoPedido === "RETIRADA" ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setTipoPedido("RETIRADA")}
                      >
                        Retirada
                      </Button>
                      <Button
                        variant={draft.tipoPedido === "ENTREGA" ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setTipoPedido("ENTREGA")}
                      >
                        Entrega
                      </Button>
                    </div>
                  )}

                  {draft.tipoPedido === "RETIRADA" && !comandaId && (
                    <p className="text-sm text-muted-foreground">Cliente busca o pedido quando estiver pronto</p>
                  )}

                  {draft.tipoPedido === "ENTREGA" && !comandaId && (
                    <p className="text-sm text-muted-foreground">Pedido será entregue no endereço do cliente</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Cliente</label>
                  {draft.customer ? (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{draft.customer.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {draft.customer.phone ? formatPhone(draft.customer.phone) : "Sem telefone"}
                            </p>
                            {draft.customer.neighborhood && (
                              <p className="text-sm text-muted-foreground">
                                {draft.customer.neighborhood}, {draft.customer.city}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setCustomer(null)
                              setCustomerSearchTerm("")
                            }}
                          >
                            Trocar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <Input
                        placeholder="Buscar por nome ou telefone..."
                        value={customerSearchTerm}
                        onChange={(e) => setCustomerSearchTerm(e.target.value)}
                      />

                      {customerSearchResults.length > 0 && (
                        <div className="space-y-2 rounded-md border p-2">
                          {customerSearchResults.map((customer) => (
                            <div
                              key={customer.id}
                              className="cursor-pointer rounded p-2 hover:bg-accent"
                              onClick={() => {
                                setCustomer(customer)
                                setCustomerSearchTerm("")
                                setCustomerSearchResults([])
                              }}
                            >
                              <p className="font-medium">{customer.name}</p>
                              <p className="text-sm text-muted-foreground">{customer.phone}</p>
                              {customer.neighborhood && (
                                <p className="text-sm text-muted-foreground">
                                  {customer.neighborhood}, {customer.city}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <Button
                        variant="outline"
                        className="w-full bg-transparent"
                        onClick={() => setShowNewCustomerForm(true)}
                      >
                        Novo cliente
                      </Button>
                    </>
                  )}
                </div>

                {isEntrega && draft.customer && (
                  <div className="space-y-3 border-t pt-3">
                    <Label>Taxa de entrega</Label>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="delivery-fee">R$</Label>
                      <Input
                        id="delivery-fee"
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.deliveryFee}
                        onChange={(e) => setDeliveryFee(Number.parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-3 border-t pt-3">
                  <Label htmlFor="payment-method">Forma de pagamento</Label>
                  <Select value={draft.paymentMethodId || ""} onValueChange={setPaymentMethod}>
                    <SelectTrigger id="payment-method">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((method) => (
                        <SelectItem key={method.id} value={method.id}>
                          {method.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3 border-t pt-3">
                  <Label htmlFor="order-notes">Observações do pedido</Label>
                  <Textarea
                    id="order-notes"
                    placeholder="Ex: entregar até às 18h"
                    value={draft.notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="border-t pt-3">
                  {draft.deliveryFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Taxa de entrega:</span>
                      <span>R$ {draft.deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xl font-bold">
                    <span>Total:</span>
                    <span>R$ {total.toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleConfirmOrder}
                  disabled={draft.items.length === 0 || !draft.customer || !draft.paymentMethodId || isCreatingOrder}
                >
                  <CheckCircle className="mr-2 h-5 w-5" />
                  {isCreatingOrder ? "Criando pedido..." : "Confirmar pedido"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      </div>

      <CustomerFormDialog
        open={showNewCustomerForm}
        customer={null}
        onClose={(saved) => {
          setShowNewCustomerForm(false)
          if (saved) {
            setCustomerSearchTerm("")
          }
        }}
      />
    </>
  )
}
