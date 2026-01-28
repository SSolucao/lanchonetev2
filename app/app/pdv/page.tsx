"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { usePdvOrder } from "@/src/hooks/usePdvOrder"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Search, Plus, Minus, Trash2, Calculator, CheckCircle, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Product, PaymentMethod, Customer, Restaurant } from "@/src/domain/types"
import { formatPhone, formatCEP, unformatNumbers, fetchAddressFromCEP } from "@/lib/format-utils"
import { CustomerFormDialog } from "@/src/components/CustomerFormDialog"
import { buildEscposFromOrder, getPrinterConfig, printCupom } from "@/src/lib/print/qzClient"

export default function PdvPage() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const comandaId = searchParams.get("comanda_id")

  const {
    draft,
    addItem,
    addItemWithAddons,
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
  const [addonsCatalog, setAddonsCatalog] = useState<any[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [categorySearch, setCategorySearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [customerSearchTerm, setCustomerSearchTerm] = useState("")
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([])
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [isCalculatingFee, setIsCalculatingFee] = useState(false)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [loadingCEP, setLoadingCEP] = useState(false)
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)
  const [createdOrderNumber, setCreatedOrderNumber] = useState<number | null>(null)
  const [comanda, setComanda] = useState<any>(null)
  const [openComandas, setOpenComandas] = useState<any[]>([])
  const [isLoadingComandas, setIsLoadingComandas] = useState(false)
  const [selectedComandaId, setSelectedComandaId] = useState<string | null>(null)
  const [isComandaDialogOpen, setIsComandaDialogOpen] = useState(false)
  const [newComandaMesa, setNewComandaMesa] = useState("")
  const [newComandaCustomerName, setNewComandaCustomerName] = useState("")
  const [isCreatingComanda, setIsCreatingComanda] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [itemQuantity, setItemQuantity] = useState(1)
  const [itemNotes, setItemNotes] = useState("")
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({})
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [categoryModal, setCategoryModal] = useState<string | null>(null)
  const addressPromptedCustomerId = useRef<string | null>(null)
  const [modalPage, setModalPage] = useState(1)
  const MODAL_PAGE_SIZE = 12

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
        setAddonsCatalog(data.addons || [])
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

  const fetchOpenComandas = useCallback(async () => {
    try {
      setIsLoadingComandas(true)
      const res = await fetch("/api/comandas?status=ABERTA")
      if (!res.ok) {
        throw new Error("Falha ao carregar comandas")
      }
      const data = await res.json()
      setOpenComandas(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("[v0] Error loading open comandas:", error)
      toast({
        variant: "destructive",
        title: "Erro ao carregar comandas",
        description: "Não foi possível listar comandas abertas.",
      })
    } finally {
      setIsLoadingComandas(false)
    }
  }, [toast])

  useEffect(() => {
    if (!comandaId && draft.tipoPedido === "BALCAO") {
      fetchOpenComandas()
    }
  }, [comandaId, draft.tipoPedido, fetchOpenComandas])

  useEffect(() => {
    if (draft.tipoPedido !== "BALCAO" && selectedComandaId) {
      setSelectedComandaId(null)
    }
  }, [draft.tipoPedido, selectedComandaId])

  useEffect(() => {
    const normalizedSearch = customerSearchTerm.trim()
    if (!normalizedSearch || normalizedSearch.length < 2) {
      setCustomerSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        if (!restaurant) return
        const results = await fetch(
          `/api/customers/search?restaurantId=${restaurant.id}&searchTerm=${encodeURIComponent(normalizedSearch)}`,
        ).then((response) => response.json())
        setCustomerSearchResults(results)
      } catch (error) {
        console.error("[v0] Error searching customers:", error)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [customerSearchTerm, restaurant])

  const availableProducts = products

  const categories = Array.from(
    new Set(
      availableProducts
        .map((p) => p.category)
        .filter((c): c is string => Boolean(c && c.trim().length > 0))
        .map((c) => c.trim()),
    ),
  )
    .filter((c) => (categorySearch ? c.toLowerCase().includes(categorySearch.toLowerCase()) : true))
    .sort((a, b) => a.localeCompare(b))

  const filteredProducts = availableProducts.filter((product) => {
    const matchesSearch = searchTerm.trim() === "" || product.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
    const matchesCategory = !selectedCategory || product.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const modalTotalPages = Math.max(1, Math.ceil(filteredProducts.length / MODAL_PAGE_SIZE))
  const modalPageSafe = Math.min(modalPage, modalTotalPages)
  const modalPageItems = filteredProducts.slice(
    (modalPageSafe - 1) * MODAL_PAGE_SIZE,
    modalPageSafe * MODAL_PAGE_SIZE,
  )

  const productsByCategory = availableProducts.reduce<Record<string, Product[]>>((acc, product) => {
    const cat = product.category || "Sem categoria"
    acc[cat] = acc[cat] || []
    acc[cat].push(product)
    return acc
  }, {})

  const resolveProductAddons = (product: Product) => {
    if (product.addons && product.addons.length > 0) {
      return product.addons
    }
    // fallback: usar catálogo filtrando por categoria e ativos
    return addonsCatalog.filter((ad) => {
      const category = product.category
      if (!category || !ad.is_active) return false
      const matchesArray = Array.isArray((ad as any).categories) && (ad as any).categories.includes(category)
      const matchesLegacy = ad.category === category
      return matchesArray || matchesLegacy
    })
  }

  const openProductModal = (product: Product) => {
    setSelectedProduct(product)
    setItemQuantity(1)
    setItemNotes("")
    setSelectedAddons({})
  }

  const toggleAddonQuantity = (addonId: string, delta: number) => {
    setSelectedAddons((prev) => {
      const current = prev[addonId] || 0
      const next = Math.max(0, current + delta)
      const newState = { ...prev, [addonId]: next }
      if (next === 0) {
        delete newState[addonId]
      }
      return newState
    })
  }

  const handleAddSelectedProduct = () => {
    if (!selectedProduct) return
    const availableAddons = resolveProductAddons(selectedProduct)
    const addonsList =
      availableAddons
        ?.filter((ad: any) => selectedAddons[ad.id] && selectedAddons[ad.id] > 0)
        .map((ad: any) => ({
          addon_id: ad.id,
          name: ad.name,
          price: Number(ad.price) || 0,
          quantity: selectedAddons[ad.id],
        })) || []

    if (addonsList.length === 0 && itemNotes.trim() === "" && itemQuantity === 1) {
      addItem(selectedProduct)
    } else {
      addItemWithAddons(selectedProduct, itemQuantity, itemNotes.trim(), addonsList)
    }

    setSelectedProduct(null)
  }

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

  const handleCreateComanda = useCallback(async () => {
    if (!newComandaMesa.trim()) {
      toast({
        variant: "destructive",
        title: "Mesa obrigatória",
        description: "Informe o número ou identificação da mesa.",
      })
      return
    }

    setIsCreatingComanda(true)
    try {
      const res = await fetch("/api/comandas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mesa: newComandaMesa.trim(),
          customer_name: newComandaCustomerName.trim() || null,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || "Falha ao criar comanda")
      }

      const created = await res.json()
      setSelectedComandaId(created?.id || null)
      setNewComandaMesa("")
      setNewComandaCustomerName("")
      setIsComandaDialogOpen(false)
      fetchOpenComandas()
      toast({
        title: "Comanda criada",
        description: "Comanda aberta e vinculada ao pedido.",
      })
    } catch (error) {
      console.error("[v0] Error creating comanda:", error)
      toast({
        variant: "destructive",
        title: "Erro ao criar comanda",
        description: error instanceof Error ? error.message : "Tente novamente.",
      })
    } finally {
      setIsCreatingComanda(false)
    }
  }, [fetchOpenComandas, newComandaCustomerName, newComandaMesa, toast])

  const handleConfirmOrder = useCallback(async () => {
    if (!restaurant) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Restaurante não carregado.",
      })
      return
    }

    const effectiveComandaId = comandaId || selectedComandaId
    const isComandaFlow = Boolean(effectiveComandaId)

    if (draft.items.length === 0) {
      toast({
        variant: "destructive",
        title: "Pedido vazio",
        description: "Adicione pelo menos um item ao pedido.",
      })
      return
    }

    if (!draft.customer && !isComandaFlow) {
      toast({
        variant: "destructive",
        title: "Cliente obrigatório",
        description: "Selecione ou cadastre um cliente.",
      })
      return
    }

    const isDeliveryOrder = draft.tipoPedido === "ENTREGA"
    if (isDeliveryOrder && draft.customer?.delivery_available === false) {
      toast({
        variant: "destructive",
        title: "Entrega indisponível",
        description: "Cadastre uma taxa por bairro ou informe o CEP para calcular por KM.",
      })
      return
    }
    if (
      isDeliveryOrder &&
      (!draft.customer.cep ||
        !draft.customer.street ||
        !draft.customer.number ||
        !draft.customer.neighborhood ||
        !draft.customer.city)
    ) {
      toast({
        variant: "destructive",
        title: "Endereço obrigatório",
        description: "Para entrega, complete o cadastro com endereço.",
      })
      return
    }

    if (!draft.paymentMethodId && !isComandaFlow) {
      toast({
        variant: "destructive",
        title: "Forma de pagamento",
        description: "Selecione uma forma de pagamento.",
      })
      return
    }

    setIsCreatingOrder(true)
    try {
      const itemsInput = draft.items.map((item) => {
        const addonsTotal = item.addons.reduce((sum, ad) => sum + ad.price * ad.quantity, 0)
        const total_price = (item.product.price + addonsTotal) * item.quantity
        return {
          order_id: "",
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.product.price,
          total_price,
          notes: item.notes || undefined,
          addons: item.addons.map((ad) => ({ addon_id: ad.addon_id, quantity: ad.quantity })),
        }
      })

      let responseCreateOrder: Response

      if (isComandaFlow && effectiveComandaId) {
        const itemsPayload = itemsInput.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          notes: item.notes || null,
          addons: item.addons,
        }))

        responseCreateOrder = await fetch("/api/comandas/order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            comanda_id: effectiveComandaId,
            items: itemsPayload,
          }),
        })
      } else {
        const responseOrderNumber = await fetch(`/api/orders/next-number?restaurantId=${restaurant.id}`)
        const orderNumber = await responseOrderNumber.json()

        const requiresKitchen = draft.items.some((item) => Boolean(item.product.requires_kitchen))
        const needsWorkflow = draft.tipoPedido === "ENTREGA" || draft.tipoPedido === "RETIRADA"

        const orderInput = {
          restaurant_id: restaurant.id,
          order_number: orderNumber,
          tipo_pedido: draft.tipoPedido,
          customer_id: draft.customer?.id,
          subtotal,
          delivery_fee: draft.deliveryFee,
          total,
          payment_method_id: draft.paymentMethodId,
          payment_status: "PAGO" as const,
          status: (requiresKitchen || needsWorkflow ? "EM_PREPARO" : "FINALIZADO") as const,
          notes: draft.notes,
        }

        responseCreateOrder = await fetch("/api/orders/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ orderInput, itemsInput }),
        })
      }

      if (!responseCreateOrder.ok) {
        const body = await responseCreateOrder.json().catch(() => ({}))
        throw new Error(body?.error || "Falha ao criar pedido")
      }

      const { order } = await responseCreateOrder.json()
      if (!order) {
        throw new Error("Pedido não retornado pela API")
      }

      await fetch(`/api/orders/update-stock?orderId=${order.id}`, {
        method: "POST",
      })

      setCreatedOrderId(order.id)
      setCreatedOrderNumber(order.order_number)

      const printerConfig = getPrinterConfig()
      if (printerConfig.autoPrint && printerConfig.selectedPrinter) {
        try {
          const detailRes = await fetch(`/api/orders/${order.id}/print-data`)
          if (detailRes.ok) {
            const data = await detailRes.json()
            const payload = buildEscposFromOrder(data.order)
            await printCupom(printerConfig.selectedPrinter, payload, printerConfig.vias)
          }
        } catch (err) {
          console.error("[v0] Auto-print ao criar pedido falhou:", err)
        }
      }

      if (printerConfig.sendCustomerPdf) {
        try {
          await fetch(`/api/orders/${order.id}/send-customer-pdf`, { method: "POST" })
        } catch (err) {
          console.error("[v0] Envio do PDF para o cliente falhou:", err)
        }
      }

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
  }, [restaurant, draft, subtotal, total, clearDraft, toast, comandaId, selectedComandaId])

  const handleNewOrder = () => {
    setCreatedOrderId(null)
    setCreatedOrderNumber(null)
  }

  const effectiveComandaId = comandaId || selectedComandaId
  const isComandaFlow = Boolean(effectiveComandaId)
  const isEntrega = draft.tipoPedido === "ENTREGA"
  const deliveryBlocked = Boolean(isEntrega && draft.customer && draft.customer.delivery_available === false)

  // Sempre que seleciona cliente ou muda para entrega, aplica taxa padrão do cliente
  useEffect(() => {
    if (isEntrega && draft.customer) {
      setDeliveryFee(draft.customer.delivery_fee_default || 0)
    }
  }, [isEntrega, draft.customer, setDeliveryFee])

  useEffect(() => {
    setModalPage(1)
  }, [searchTerm, selectedCategory, categoryModalOpen])

  useEffect(() => {
    if (!draft.customer) return

    if (draft.tipoPedido === "ENTREGA" && draft.customer.delivery_available === false) {
      setTipoPedido("RETIRADA")
      toast({
        title: "Entrega indisponível",
        description: "Cliente sem entrega disponível. Tipo alterado para Retirada.",
      })
    }
  }, [draft.customer, draft.tipoPedido, setTipoPedido, toast])

  useEffect(() => {
    if (!isEntrega) {
      addressPromptedCustomerId.current = null
      return
    }

    if (!draft.customer) return

    const missingAddress =
      !draft.customer.cep ||
      !draft.customer.street ||
      !draft.customer.number ||
      !draft.customer.neighborhood ||
      !draft.customer.city

    if (!missingAddress) {
      addressPromptedCustomerId.current = null
      return
    }

    if (addressPromptedCustomerId.current === draft.customer.id) return

    addressPromptedCustomerId.current = draft.customer.id
    setEditingCustomer(draft.customer)
    setShowCustomerForm(true)
  }, [isEntrega, draft.customer])

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
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar categoria..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Card
                    className="cursor-pointer transition-colors hover:bg-accent"
                    onClick={() => {
                      setSelectedCategory(null)
                      setCategoryModal("Todos")
                      setCategoryModalOpen(true)
                      setSearchTerm("")
                    }}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <span className="font-semibold">Todas</span>
                      <span className="text-sm text-muted-foreground">{products.length} itens</span>
                    </CardContent>
                  </Card>

                  {categories.map((cat) => (
                    <Card
                      key={cat}
                      className="cursor-pointer transition-colors hover:bg-accent"
                      onClick={() => {
                        setSelectedCategory(cat)
                        setCategoryModal(cat)
                        setCategoryModalOpen(true)
                        setSearchTerm("")
                      }}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <span className="font-semibold">{cat}</span>
                        <span className="text-sm text-muted-foreground">
                          {(productsByCategory[cat] || []).length} itens
                        </span>
                      </CardContent>
                    </Card>
                  ))}

                  {categories.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground col-span-full">
                      Nenhuma categoria encontrada
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="w-full lg:w-[360px] shrink-0">
          {createdOrderId && createdOrderNumber ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-center">
                  {draft.tipoPedido === "BALCAO" ? "Pedido finalizado!" : "Pedido criado com sucesso!"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-4">
                  <p className="text-5xl font-bold text-green-600 mb-2">#{createdOrderNumber}</p>
                  <p className="text-muted-foreground">
                    {draft.tipoPedido === "BALCAO"
                      ? "Pedido finalizado e impresso automaticamente"
                      : "Pedido registrado no sistema"}
                  </p>
                </div>

                <div className="space-y-3">
                  {draft.tipoPedido !== "BALCAO" && (
                    <>
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
                    </>
                  )}

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
                      <Card key={item.id}>
                        <CardContent className="space-y-2 p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium">{item.product.name}</h4>
                              <p className="text-sm text-muted-foreground">R$ {item.product.price.toFixed(2)} un.</p>
                              {item.addons.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                  {item.addons.map((ad) => (
                                    <div key={ad.addon_id} className="flex justify-between gap-2">
                                      <span className="truncate">
                                        {ad.quantity}x {ad.name}
                                      </span>
                                      <span>R$ {(ad.price * ad.quantity).toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 bg-transparent"
                              onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-12 text-center font-medium">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 bg-transparent"
                              onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <span className="ml-auto font-semibold">
                              {(() => {
                                const addonsTotal = item.addons.reduce((sum, ad) => sum + ad.price * ad.quantity, 0)
                                return `R$ ${((item.product.price + addonsTotal) * item.quantity).toFixed(2)}`
                              })()}
                            </span>
                          </div>

                          <Input
                            placeholder="Observação (ex: sem cebola)"
                            value={item.notes}
                            onChange={(e) => updateItemNotes(item.id, e.target.value)}
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
                        Consumo
                      </Button>
                      <Button
                        variant={draft.tipoPedido === "RETIRADA" ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setTipoPedido("RETIRADA")}
                      >
                        Retirada
                      </Button>
                      {!deliveryBlocked && (
                        <Button
                          variant={draft.tipoPedido === "ENTREGA" ? "default" : "outline"}
                          className="flex-1"
                          onClick={() => setTipoPedido("ENTREGA")}
                        >
                          Entrega
                        </Button>
                      )}
                    </div>
                  )}

                  {draft.tipoPedido === "RETIRADA" && !comandaId && (
                    <p className="text-sm text-muted-foreground">Cliente busca o pedido quando estiver pronto</p>
                  )}

                  {draft.tipoPedido === "ENTREGA" && !comandaId && (
                    <p className="text-sm text-muted-foreground">Pedido será entregue no endereço do cliente</p>
                  )}
                </div>

                {draft.tipoPedido === "BALCAO" && !comandaId && (
                  <div className="space-y-2 border-t pt-3">
                    <Label>Comanda (opcional)</Label>
                    <div className="flex flex-col gap-2">
                      <Select
                        value={selectedComandaId || "none"}
                        onValueChange={(value) => {
                          if (value === "none") {
                            setSelectedComandaId(null)
                            return
                          }
                          setSelectedComandaId(value)
                          const selected = openComandas.find((c) => c.id === value)
                          if (selected?.customer) {
                            setCustomer(selected.customer)
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma comanda" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Pedido rápido (sem comanda)</SelectItem>
                          {openComandas.length === 0 && (
                            <SelectItem value="empty" disabled>
                              {isLoadingComandas ? "Carregando comandas..." : "Nenhuma comanda aberta"}
                            </SelectItem>
                          )}
                          {openComandas.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {`Comanda #${String(c.numero).padStart(3, "0")} - Mesa ${c.mesa}${
                                c.customer_name ? ` (${c.customer_name})` : ""
                              }`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        className="w-full bg-transparent"
                        onClick={() => setIsComandaDialogOpen(true)}
                      >
                        Criar comanda
                      </Button>
                    </div>
                    {selectedComandaId && (
                      <p className="text-xs text-muted-foreground">
                        Pedido será vinculado à comanda selecionada.
                      </p>
                    )}
                  </div>
                )}

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
                        placeholder="Buscar por telefone ou nome..."
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
                        onClick={() => {
                          setEditingCustomer(null)
                          setShowCustomerForm(true)
                        }}
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
                    {deliveryBlocked && (
                      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        Entrega indisponível para este cliente. Cadastre uma taxa por bairro ou use CEP para KM.
                      </div>
                    )}
                  </div>
                )}

                {!isComandaFlow && (
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
                )}

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
                  disabled={
                    draft.items.length === 0 ||
                    (!draft.customer && !isComandaFlow) ||
                    (!draft.paymentMethodId && !isComandaFlow) ||
                    deliveryBlocked ||
                    isCreatingOrder
                  }
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

      {/* Modal de produtos por categoria */}
      <Dialog open={categoryModalOpen} onOpenChange={(v) => !v && setCategoryModalOpen(false)}>
        <DialogContent className="max-w-6xl sm:max-w-6xl w-[96vw] h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {categoryModal && categoryModal !== "Todos" ? `Produtos - ${categoryModal}` : "Todos os produtos"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex h-full flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="grid auto-rows-[120px] gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {modalPageItems.map((product) => (
                  <Card
                    key={product.id}
                    className="cursor-pointer transition-colors hover:bg-accent border shadow-sm h-full"
                    onClick={() => {
                      setCategoryModalOpen(false)
                      openProductModal(product)
                    }}
                  >
                    <CardContent className="p-3 space-y-2 h-full">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium line-clamp-2">{product.name}</h3>
                            {product.type === "COMBO" && (
                              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                Combo
                              </span>
                            )}
                          </div>
                          {product.category && (
                            <p className="text-xs text-muted-foreground truncate">{product.category}</p>
                          )}
                        </div>
                        <p className="text-base font-semibold whitespace-nowrap">R$ {product.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Selecionar</span>
                        <Plus className="h-4 w-4" />
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {filteredProducts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground col-span-full">
                    Nenhum produto encontrado
                  </div>
                )}
              </div>
            </div>

            {modalTotalPages > 1 && (
              <div className="mt-auto flex items-center justify-center gap-2 border-t pt-3 pb-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={modalPageSafe === 1}
                  onClick={() => setModalPage(modalPageSafe - 1)}
                >
                  &lt;
                </Button>
                {(() => {
                  const windowSize = 3
                  const half = Math.floor(windowSize / 2)
                  let start = Math.max(1, modalPageSafe - half)
                  let end = Math.min(modalTotalPages, start + windowSize - 1)
                  start = Math.max(1, end - windowSize + 1)

                  return Array.from({ length: end - start + 1 }, (_, index) => {
                    const page = start + index
                    return (
                      <Button
                        key={page}
                        variant={page === modalPageSafe ? "default" : "outline"}
                        size="sm"
                        onClick={() => setModalPage(page)}
                      >
                        {page}
                      </Button>
                    )
                  })
                })()}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={modalPageSafe === modalTotalPages}
                  onClick={() => setModalPage(modalPageSafe + 1)}
                >
                  &gt;
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isComandaDialogOpen} onOpenChange={setIsComandaDialogOpen}>
        <DialogContent className="max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle>Nova comanda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="comanda-mesa">Mesa</Label>
              <Input
                id="comanda-mesa"
                placeholder="Ex: 12"
                value={newComandaMesa}
                onChange={(e) => setNewComandaMesa(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comanda-customer">Nome (opcional)</Label>
              <Input
                id="comanda-customer"
                placeholder="Ex: João"
                value={newComandaCustomerName}
                onChange={(e) => setNewComandaCustomerName(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsComandaDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateComanda} disabled={isCreatingComanda}>
                {isCreatingComanda ? "Criando..." : "Criar comanda"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de seleção de produto e adicionais */}
      <Dialog open={!!selectedProduct} onOpenChange={(v) => !v && setSelectedProduct(null)}>
        <DialogContent className="max-w-2xl w-[95vw]">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedProduct.name}</DialogTitle>
                {selectedProduct.category && (
                  <p className="text-sm text-muted-foreground">{selectedProduct.category}</p>
                )}
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="space-y-1">
                    <span className="text-lg font-semibold block">R$ {selectedProduct.price.toFixed(2)}</span>
                    {selectedProduct.category && (
                      <span className="text-xs text-muted-foreground">Categoria: {selectedProduct.category}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 bg-transparent"
                      onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-12 text-center font-semibold text-lg">{itemQuantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 bg-transparent"
                      onClick={() => setItemQuantity(itemQuantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Adicionais</Label>
                  {resolveProductAddons(selectedProduct) && resolveProductAddons(selectedProduct).length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1">
                      {resolveProductAddons(selectedProduct).map((ad: any) => {
                        const qty = selectedAddons[ad.id] || 0
                        return (
                          <Card key={ad.id} className="p-3 border shadow-sm">
                            <div className="space-y-2">
                              <div>
                                <p className="font-medium text-sm line-clamp-2">{ad.name}</p>
                                <p className="text-xs text-muted-foreground">R$ {Number(ad.price).toFixed(2)}</p>
                              </div>
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs text-muted-foreground">Qtd.</span>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7 bg-transparent"
                                    onClick={() => toggleAddonQuantity(ad.id, -1)}
                                    disabled={qty <= 0}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-8 text-center text-sm font-semibold">{qty}</span>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7 bg-transparent"
                                    onClick={() => toggleAddonQuantity(ad.id, 1)}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhum adicional disponível para este produto (vincule em Produtos &gt; Adicionais).
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Observação do item</Label>
                  <Textarea
                    placeholder="Ex: sem cebola"
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setSelectedProduct(null)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddSelectedProduct}>Adicionar</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <CustomerFormDialog
        open={showCustomerForm}
        customer={editingCustomer}
        mode={isEntrega ? "full" : "minimal"}
        requireAddress={isEntrega}
        onSaved={(savedCustomer) => {
          setCustomer(savedCustomer)
          setCustomerSearchTerm("")
          setCustomerSearchResults([])
        }}
        onClose={(saved) => {
          setShowCustomerForm(false)
          setEditingCustomer(null)
          if (saved) {
            setCustomerSearchTerm("")
          }
        }}
      />
    </>
  )
}
