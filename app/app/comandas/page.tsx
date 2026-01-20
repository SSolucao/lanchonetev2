"use client"

import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/src/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Plus, RefreshCw, Clock, Receipt, User, Minus, ShoppingCart, Trash2, Search, Send } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Textarea } from "@/components/ui/textarea"
import { buildEscposFromOrder, getPrinterConfig, printCupom } from "@/src/lib/print/qzClient"

interface Product {
  id: string
  name: string
  price: number
  category: string
  type: string
  is_active: boolean
  addons?: Array<Addon>
}

interface Addon {
  id: string
  name: string
  price: number
  category?: string
  categories?: string[]
  is_active?: boolean
}

interface CartItem {
  product: Product
  quantity: number
  observations: string
  addons: Array<{ addon_id: string; name: string; price: number; quantity: number }>
}

interface Comanda {
  id: string
  numero: number
  mesa: string
  customer_name?: string | null
  status: "ABERTA" | "FECHADA"
  total: number
  pedidos_count?: number
  opened_at: string
  closed_at?: string
  orders?: Array<{
    id: string
    order_number: number
    total: number
    status: string
    created_at: string
    items?: Array<{
      product_name: string
      quantity: number
      unit_price: number
      notes?: string
    }>
  }>
}

export default function ComandasPage() {
  const { currentUser } = useAuth()
  const { toast } = useToast()

  const [comandas, setComandas] = useState<Comanda[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().slice(0, 10))

  const [mesa, setMesa] = useState("")
  const [customerName, setCustomerName] = useState("")

  const [selectedComanda, setSelectedComanda] = useState<Comanda | null>(null)
  const [isAddProductsOpen, setIsAddProductsOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos")
  const [productSearchTerm, setProductSearchTerm] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [itemQuantity, setItemQuantity] = useState(1)
  const [itemNotes, setItemNotes] = useState("")
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({})
  const [addons, setAddons] = useState<Addon[]>([])

  // Close comanda dialog
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false)
  const [closeComandaData, setCloseComandaData] = useState<Comanda | null>(null)
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>("")
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    fetchComandas()
    fetchProducts()
    fetchPaymentMethods()
    fetchAddons()
  }, [])

  const fetchComandas = async (date: string = dateFilter) => {
    const normalizedDate = typeof date === "string" ? date : dateFilter
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (normalizedDate) params.set("date", normalizedDate)
      const res = await fetch(`/api/comandas?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setComandas(data)
      }
    } catch (error) {
      console.error("Error fetching comandas:", error)
      toast({
        title: "Erro",
        description: "Não foi possível carregar as comandas",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products?include_addons=1")
      if (res.ok) {
        const data = await res.json()
        const activeProducts = data.filter((p: Product) => p.is_active)
        setProducts(activeProducts)

        const uniqueCategories = [
          ...new Set(activeProducts.map((p: Product) => p.category).filter(Boolean)),
        ] as string[]
        setCategories(uniqueCategories)
      }
    } catch (error) {
      console.error("Error fetching products:", error)
    }
  }

  const fetchAddons = async () => {
    try {
      const res = await fetch("/api/addons")
      if (res.ok) {
        const data = await res.json()
        setAddons(data.filter((ad: Addon) => ad.is_active !== false))
      }
    } catch (error) {
      console.error("Error fetching addons:", error)
    }
  }

  const fetchPaymentMethods = async () => {
    try {
      const res = await fetch("/api/payment-methods")
      if (res.ok) {
        const data = await res.json()
        setPaymentMethods(data.filter((pm: any) => pm.is_active))
      }
    } catch (error) {
      console.error("Error fetching payment methods:", error)
    }
  }

  const handleCreateComanda = async () => {
    if (!mesa.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Informe a mesa",
        variant: "destructive",
      })
      return
    }

    setIsCreating(true)
    try {
      const res = await fetch("/api/comandas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mesa: mesa.trim(),
          customer_name: customerName.trim() || null,
        }),
      })

      if (res.ok) {
        toast({
          title: "Comanda criada",
          description: "Comanda criada com sucesso",
        })
        setIsCreateDialogOpen(false)
        setMesa("")
        setCustomerName("")
        fetchComandas()
      } else {
        throw new Error("Failed to create comanda")
      }
    } catch (error) {
      console.error("Error creating comanda:", error)
      toast({
        title: "Erro",
        description: "Não foi possível criar a comanda",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleOpenAddProducts = (comanda: Comanda) => {
    setSelectedComanda(comanda)
    setCart([])
    setSelectedCategory("Todos")
    setProductSearchTerm("")
    setIsAddProductsOpen(true)
  }

  const addToCart = (product: Product) => {
    // Abre modal de addons
    setSelectedProduct(product)
    setItemQuantity(1)
    setItemNotes("")
    setSelectedAddons({})
  }

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId))
  }

  const updateCartQuantity = (productId: string, newQuantity: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          return { ...item, quantity: newQuantity }
        }
        return item
      }),
    )
  }

  const updateCartObservation = (productId: string, observations: string) => {
    setCart((prev) => prev.map((item) => (item.product.id === productId ? { ...item, observations } : item)))
  }

  const cartTotal = cart.reduce((sum, item) => {
    const addonsTotal = item.addons.reduce((acc, ad) => acc + ad.price * ad.quantity, 0)
    return sum + (item.product.price + addonsTotal) * item.quantity
  }, 0)

  const toggleAddonQuantity = (addonId: string, delta: number) => {
    setSelectedAddons((prev) => {
      const current = prev[addonId] || 0
      const next = Math.max(0, current + delta)
      const newState = { ...prev, [addonId]: next }
      if (next === 0) delete newState[addonId]
      return newState
    })
  }

  const resolveProductAddons = (product: Product) => {
    if (product.addons && product.addons.length > 0) return product.addons
    if (!product.category) return []
    return addons.filter((ad) => {
      const inArray = Array.isArray(ad.categories) && ad.categories.includes(product.category)
      const legacyMatch = ad.category === product.category
      return ad.is_active !== false && (inArray || legacyMatch)
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

    setCart((prev) => [
      ...prev,
      {
        product: selectedProduct,
        quantity: Math.max(1, itemQuantity),
        observations: itemNotes.trim(),
        addons: addonsList,
      },
    ])

    setSelectedProduct(null)
  }

  const handleSubmitOrder = async () => {
    if (!selectedComanda || cart.length === 0) return

    console.log("[v0] Submitting order for comanda:", selectedComanda.id)
    console.log("[v0] Cart items:", cart)

    setIsSubmittingOrder(true)
    try {
      const res = await fetch("/api/comandas/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comanda_id: selectedComanda.id,
          items: cart.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
            notes: item.observations || null,
            addons:
              item.addons?.map((ad) => ({
                addon_id: ad.addon_id,
                quantity: ad.quantity,
              })) || [],
          })),
        }),
      })

      console.log("[v0] Order API response status:", res.status)

      if (res.ok) {
        const data = await res.json()
        console.log("[v0] Order created successfully:", data)

        const printerConfig = getPrinterConfig()
        if (printerConfig.autoPrint && printerConfig.selectedPrinter) {
          try {
            const detailRes = await fetch(`/api/orders/${data.order.id}/print-data`)
            if (detailRes.ok) {
              const detail = await detailRes.json()
              const payload = buildEscposFromOrder(detail.order)
              await printCupom(printerConfig.selectedPrinter, payload, printerConfig.vias)
            }
          } catch (err) {
            console.error("[v0] Auto-print em comanda falhou:", err)
          }
        }

        toast({
          title: "Pedido enviado",
          description: "Pedido enviado para a cozinha!",
        })
        setIsAddProductsOpen(false)
        setCart([])
        setSelectedComanda(null)

        await fetchComandas()
        console.log("[v0] Comandas refreshed after order creation")
      } else {
        const error = await res.json()
        console.error("[v0] Order API error:", error)
        throw new Error(error.error || "Failed to create order")
      }
    } catch (error: any) {
      console.error("[v0] Error creating order:", error)
      toast({
        title: "Erro",
        description: error.message || "Não foi possível enviar o pedido",
        variant: "destructive",
      })
    } finally {
      setIsSubmittingOrder(false)
    }
  }

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = selectedCategory === "Todos" || product.category === selectedCategory
      const matchesSearch = product.name.toLowerCase().includes(productSearchTerm.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [products, selectedCategory, productSearchTerm])

  useEffect(() => {
    if (selectedProduct) {
      setItemQuantity(1)
      setItemNotes("")
      setSelectedAddons({})
    }
  }, [selectedProduct])

  const handleFecharComanda = async (comanda: Comanda) => {
    try {
      console.log("[v0] Fetching comanda details for:", comanda.id)
      const res = await fetch(`/api/comandas/${comanda.id}`)
      if (!res.ok) {
        const errorData = await res.json()
        console.error("[v0] Error response:", errorData)
        throw new Error(errorData.error || "Failed to fetch comanda")
      }

      const fullComanda = await res.json()
      console.log("[v0] Full comanda data:", fullComanda)
      setCloseComandaData(fullComanda)
      setSelectedPaymentMethodId("")
      setIsCloseDialogOpen(true)
    } catch (error) {
      console.error("[v0] Error fetching comanda details:", error)
      toast({
        title: "Erro",
        description: "Não foi possível carregar os detalhes da comanda",
        variant: "destructive",
      })
    }
  }

  const confirmFecharComanda = async () => {
    console.log("[v0] confirmFecharComanda called")
    console.log("[v0] closeComandaData:", closeComandaData)
    console.log("[v0] selectedPaymentMethodId:", selectedPaymentMethodId)

    if (!closeComandaData) {
      console.log("[v0] No closeComandaData")
      return
    }

    if (!selectedPaymentMethodId) {
      toast({
        title: "Campo obrigatório",
        description: "Selecione a forma de pagamento",
        variant: "destructive",
      })
      return
    }

    setIsClosing(true)
    try {
      console.log("[v0] Sending request to close comanda")
      const res = await fetch(`/api/comandas/${closeComandaData.id}/fechar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_method_id: selectedPaymentMethodId,
        }),
      })

      console.log("[v0] Response status:", res.status)

      if (res.ok) {
        const data = await res.json()
        console.log("[v0] Success response:", data)
        toast({
          title: "Comanda fechada",
          description: "Comanda fechada com sucesso",
        })
        setIsCloseDialogOpen(false)
        setCloseComandaData(null)
        setSelectedPaymentMethodId("")
        fetchComandas()
      } else {
        const errorData = await res.json()
        if (res.status === 409 && errorData?.error) {
          toast({
            title: "Pedidos em aberto",
            description: errorData.error,
            variant: "destructive",
          })
          return
        }
        throw new Error(errorData.error || "Failed to close comanda")
      }
    } catch (error: any) {
      if (String(error.message || "").includes("pedidos em aberto")) {
        toast({
          title: "Pedidos em aberto",
          description: "Finalize os pedidos antes de fechar a comanda.",
          variant: "destructive",
        })
        return
      }
      console.warn("[v0] Error closing comanda:", error)
      toast({
        title: "Erro",
        description: error.message || "Não foi possível fechar a comanda",
        variant: "destructive",
      })
    } finally {
      setIsClosing(false)
    }
  }

  const comandasAbertas = comandas.filter((c) => c.status === "ABERTA")
  const comandasFechadas = comandas.filter((c) => c.status === "FECHADA")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Comandas</h1>
          <p className="text-muted-foreground mt-1">Gerencie comandas de consumo no local</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="date_filter" className="text-sm text-muted-foreground">
              Dia
            </Label>
            <Input
              id="date_filter"
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value)
                fetchComandas(e.target.value)
              }}
              className="w-[160px]"
            />
          </div>
          <Button
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10)
              setDateFilter(today)
              fetchComandas(today)
            }}
            variant="outline"
            size="sm"
          >
            Hoje
          </Button>
          <Button onClick={() => fetchComandas()} disabled={isLoading} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Comanda
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Comanda</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mesa">Mesa *</Label>
                  <Input
                    id="mesa"
                    placeholder="Ex: Mesa 5, Balcão 2, Varanda"
                    value={mesa}
                    onChange={(e) => setMesa(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer_name">Nome do Cliente (opcional)</Label>
                  <Input
                    id="customer_name"
                    placeholder="Ex: João Silva"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>

                <Button onClick={handleCreateComanda} disabled={isCreating} className="w-full">
                  {isCreating ? "Criando..." : "Criar Comanda"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Comandas Abertas */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Comandas Abertas ({comandasAbertas.length})</h2>

        {comandasAbertas.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhuma comanda aberta no momento
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {comandasAbertas.map((comanda) => (
              <Card key={comanda.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between">
                    <span className="text-lg">Comanda #{String(comanda.numero).padStart(3, "0")}</span>
                    <span className="text-sm font-normal bg-primary/10 text-primary px-2 py-1 rounded">
                      {comanda.mesa}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {comanda.customer_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{comanda.customer_name}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      Aberta {formatDistanceToNow(new Date(comanda.opened_at), { locale: ptBR, addSuffix: true })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    <span>{comanda.orders?.length || 0} pedido(s)</span>
                  </div>

                  <div className="pt-3 border-t">
                    <div className="text-2xl font-bold text-center">R$ {comanda.total.toFixed(2)}</div>
                    <p className="text-xs text-center text-muted-foreground">Total acumulado</p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1 bg-transparent"
                      onClick={() => handleOpenAddProducts(comanda)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Pedido
                    </Button>
                    <Button variant="default" className="flex-1" onClick={() => handleFecharComanda(comanda)}>
                      Fechar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Comandas Fechadas */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Comandas Fechadas ({comandasFechadas.length})</h2>

        {comandasFechadas.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">Nenhuma comanda fechada</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {comandasFechadas.map((comanda) => (
              <Card key={comanda.id} className="opacity-75">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">#{String(comanda.numero).padStart(3, "0")}</span>
                    <span className="text-xs text-muted-foreground">{comanda.mesa}</span>
                  </div>
                  {comanda.customer_name && (
                    <div className="text-sm text-muted-foreground mb-2">{comanda.customer_name}</div>
                  )}
                  <div className="text-lg font-bold">R$ {comanda.total.toFixed(2)}</div>
                  {comanda.closed_at && (
                    <div className="text-xs text-muted-foreground mt-2">
                      Fechada {formatDistanceToNow(new Date(comanda.closed_at), { locale: ptBR, addSuffix: true })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isAddProductsOpen} onOpenChange={setIsAddProductsOpen}>
        <DialogContent
          className="!max-w-[1250px] !w-[95vw] lg:!w-[1200px] h-[90vh] max-h-[90vh] overflow-hidden p-0 gap-0 flex flex-col"
        >
          {/* Header fixo */}
          <div className="h-14 px-6 flex items-center justify-between border-b shrink-0">
            <DialogTitle className="text-lg font-semibold">
              Adicionar Pedido - Comanda #{selectedComanda ? String(selectedComanda.numero).padStart(3, "0") : ""}
              <span className="text-muted-foreground font-normal ml-2">({selectedComanda?.mesa})</span>
            </DialogTitle>
          </div>

          {/* Corpo em duas colunas */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] overflow-hidden min-h-0">
            {/* Coluna esquerda - LISTA vertical de produtos (NÃO grid) */}
            <div className="w-full lg:w-auto shrink-0 flex flex-col border-r min-w-[520px] min-h-0">
                {/* Busca */}
                <div className="p-4 border-b shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    className="pl-9"
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Categorias */}
              <div className="p-4 border-b shrink-0">
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    variant={selectedCategory === "Todos" ? "default" : "outline"}
                    onClick={() => setSelectedCategory("Todos")}
                    className="justify-start"
                  >
                    Todos
                  </Button>
                  {categories.map((cat) => (
                    <Button
                      key={cat}
                      size="sm"
                      variant={selectedCategory === cat ? "default" : "outline"}
                      onClick={() => setSelectedCategory(cat)}
                      className="justify-start"
                    >
                      {cat}
                    </Button>
                  ))}
                </div>
              </div>

              {/* LISTA de produtos - vertical, não grid */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            <div className="space-y-2">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addToCart(product)}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.category}</p>
                      </div>
                      <span className="font-semibold text-primary whitespace-nowrap">
                        R$ {product.price.toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>

                {filteredProducts.length === 0 && (
                  <div className="text-center text-muted-foreground py-8 text-sm">Nenhum produto encontrado</div>
                )}
              </div>
              </div>

            {/* Coluna direita - Carrinho/Resumo */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-[500px] bg-white min-h-0">
              <div className="h-12 px-4 flex items-center gap-2 border-b shrink-0">
                <ShoppingCart className="h-4 w-4" />
                <span className="font-semibold">Carrinho ({cart.length})</span>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {cart.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    Clique em um produto para adicionar ao carrinho
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <Card key={item.product.id} className="p-4">
                        <div className="flex justify-between items-start gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium">{item.product.name}</h4>
                            <p className="text-sm text-muted-foreground">R$ {item.product.price.toFixed(2)} cada</p>
                            {item.addons && item.addons.length > 0 && (
                              <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                                {item.addons.map((ad) => (
                                  <div key={ad.addon_id} className="flex justify-between gap-2">
                                    <span>
                                      {ad.quantity}x {ad.name}
                                    </span>
                                    <span>R$ {(ad.price * ad.quantity).toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => removeFromCart(item.product.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 bg-transparent"
                              onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-12 text-center font-medium">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 bg-transparent"
                              onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="font-bold text-lg">
                            {(() => {
                              const addonsTotal = item.addons.reduce((acc, ad) => acc + ad.price * ad.quantity, 0)
                              return `R$ ${((item.product.price + addonsTotal) * item.quantity).toFixed(2)}`
                            })()}
                          </span>
                        </div>

                        <Textarea
                          placeholder="Observação (ex: sem cebola)"
                          value={item.observations || ""}
                          onChange={(e) => updateCartObservation(item.product.id, e.target.value)}
                          className="mt-3 resize-none"
                          rows={2}
                        />
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t p-4 shrink-0 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold">Total:</span>
                  <span className="text-2xl font-bold text-primary">R$ {cartTotal.toFixed(2)}</span>
                </div>
                <Button onClick={handleSubmitOrder} size="lg" className="w-full" disabled={cart.length === 0}>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar para Cozinha
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de produto/adicionais */}
      <Dialog open={!!selectedProduct} onOpenChange={(v) => !v && setSelectedProduct(null)}>
        <DialogContent className="max-w-xl w-[95vw]">
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
                    <p className="text-sm text-muted-foreground">Nenhum adicional disponível para este produto.</p>
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

      {/* Close Comanda Dialog */}
      <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Fechar Comanda</DialogTitle>
          </DialogHeader>

          {closeComandaData && (
            <div className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <span className="font-semibold text-lg">
                    Comanda #{String(closeComandaData.numero).padStart(3, "0")}
                  </span>
                  <span className="text-muted-foreground">{closeComandaData.mesa}</span>
                </div>
                {closeComandaData.customer_name && (
                  <p className="text-sm text-muted-foreground">{closeComandaData.customer_name}</p>
                )}
              </div>

              <div>
                <h4 className="font-semibold mb-3">Consumo</h4>
                <div className="space-y-3 max-h-[200px] overflow-y-auto">
                  {closeComandaData.orders?.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum pedido registrado</p>
                  ) : (
                    closeComandaData.orders?.map((pedido: any) => (
                      <div key={pedido.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <p className="font-medium">Pedido #{pedido.order_number}</p>
                          <p className="font-semibold">R$ {pedido.total.toFixed(2)}</p>
                        </div>
                        {pedido.items && pedido.items.length > 0 && (
                          <div className="text-sm text-muted-foreground space-y-1">
                            {pedido.items.map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between">
                                <span>
                                  {item.quantity}x {item.product_name}
                                </span>
                                <span>R$ {(item.unit_price * item.quantity).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between font-bold text-2xl">
                  <span>Total:</span>
                  <span>R$ {closeComandaData.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Forma de pagamento *</Label>
                <Select value={selectedPaymentMethodId} onValueChange={setSelectedPaymentMethodId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((pm) => (
                      <SelectItem key={pm.id} value={pm.id}>
                        {pm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={confirmFecharComanda}
                disabled={isClosing || !selectedPaymentMethodId}
                className="w-full"
                size="lg"
              >
                {isClosing ? "Fechando..." : "Confirmar e Fechar Comanda"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
