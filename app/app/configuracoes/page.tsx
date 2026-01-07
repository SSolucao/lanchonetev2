"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { Restaurant, PaymentMethod, DeliveryRule } from "@/src/domain/types"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { PaymentMethodFormDialog } from "@/src/components/PaymentMethodFormDialog"
import { DeliveryRuleFormDialog } from "@/src/components/DeliveryRuleFormDialog"
import { StockManagementTab } from "@/src/components/StockManagementTab"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { printCupom } from "@/src/lib/print/qzClient"

export default function ConfiguracoesPage() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Impressão
  const [printers, setPrinters] = useState<string[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState("")
  const [autoPrint, setAutoPrint] = useState(false)
  const [vias, setVias] = useState("2")
  const [encoding, setEncoding] = useState("CP860")
  const [codePage, setCodePage] = useState(3)
  const [sendCustomerPdf, setSendCustomerPdf] = useState(false)
  const [isListingPrinters, setIsListingPrinters] = useState(false)
  const [isTestingPrint, setIsTestingPrint] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [modalities, setModalities] = useState({
    balcao: true,
    retirada: true,
    entrega: true,
    comanda: true,
  })
  const [showHeader, setShowHeader] = useState(true)
  const [showCustomer, setShowCustomer] = useState(true)
  const [showPayment, setShowPayment] = useState(true)
  const [showObservations, setShowObservations] = useState(true)
  const [showValues, setShowValues] = useState(true)
  const [width, setWidth] = useState<"32" | "48">("32")
  const [footerText, setFooterText] = useState("")

  // Restaurant form
  const [name, setName] = useState("")
  const [cepOrigem, setCepOrigem] = useState("")
  const [address, setAddress] = useState("")
  const [deliveryEtaMin, setDeliveryEtaMin] = useState("")
  const [deliveryEtaMax, setDeliveryEtaMax] = useState("")
  const [pixKeyType, setPixKeyType] = useState("")
  const [pixKey, setPixKey] = useState("")

  const charsetOptions = [
    { label: "Português (CP860)", encoding: "CP860", codePage: 3 },
    { label: "Multilíngue (CP850)", encoding: "CP850", codePage: 2 },
    { label: "Windows-1252", encoding: "CP1252", codePage: 16 },
  ]

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethod | null>(null)
  const [deletePaymentDialogOpen, setDeletePaymentDialogOpen] = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentMethod | null>(null)
  const [deletingPayment, setDeletingPayment] = useState(false)

  // Delivery rules
  const [deliveryRules, setDeliveryRules] = useState<DeliveryRule[]>([])
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false)
  const [editingDeliveryRule, setEditingDeliveryRule] = useState<DeliveryRule | null>(null)
  const [deleteRuleDialogOpen, setDeleteRuleDialogOpen] = useState(false)
  const [ruleToDelete, setRuleToDelete] = useState<DeliveryRule | null>(null)
  const [deletingRule, setDeletingRule] = useState(false)

  useEffect(() => {
    loadData()
    const savedPrinter = typeof window !== "undefined" ? localStorage.getItem("printerConfig") : null
    if (savedPrinter) {
      try {
        const parsed = JSON.parse(savedPrinter)
        setSelectedPrinter(parsed.selectedPrinter || "")
        setAutoPrint(Boolean(parsed.autoPrint))
        setVias(parsed.vias ? String(parsed.vias) : "2")
        setEncoding(typeof parsed.encoding === "string" && parsed.encoding ? parsed.encoding : "CP860")
        setCodePage(Number.isFinite(Number(parsed.codePage)) ? Number(parsed.codePage) : 3)
        setSendCustomerPdf(Boolean(parsed.sendCustomerPdf))
      } catch (err) {
        console.warn("Não foi possível carregar configuração de impressora", err)
      }
    }
    const savedModel = typeof window !== "undefined" ? localStorage.getItem("printerModelConfig") : null
    if (savedModel) {
      try {
        const parsed = JSON.parse(savedModel)
        if (parsed.selectedCategories) setSelectedCategories(parsed.selectedCategories)
        if (parsed.modalities) setModalities(parsed.modalities)
        setShowHeader(parsed.showHeader ?? true)
        setShowCustomer(parsed.showCustomer ?? true)
        setShowPayment(parsed.showPayment ?? true)
        setShowObservations(parsed.showObservations ?? true)
        setShowValues(parsed.showValues ?? true)
        setWidth(parsed.width === "48" ? "48" : "32")
        setFooterText(parsed.footerText || "")
      } catch (err) {
        console.warn("Não foi possível carregar modelo de impressão", err)
      }
    }
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [restaurantRes, paymentRes, deliveryRes] = await Promise.all([
        fetch("/api/restaurant"),
        fetch("/api/payment-methods"),
        fetch("/api/delivery-rules"),
      ])

      if (restaurantRes.ok) {
        const restaurantData = await restaurantRes.json()
        setRestaurant(restaurantData)
        setName(restaurantData.name)
        setCepOrigem(restaurantData.cep_origem)
        setAddress(restaurantData.address)
        setDeliveryEtaMin(
          restaurantData.delivery_eta_min === null || restaurantData.delivery_eta_min === undefined
            ? ""
            : String(restaurantData.delivery_eta_min),
        )
        setDeliveryEtaMax(
          restaurantData.delivery_eta_max === null || restaurantData.delivery_eta_max === undefined
            ? ""
            : String(restaurantData.delivery_eta_max),
        )
        setPixKeyType(restaurantData.pix_key_type || "")
        setPixKey(restaurantData.pix_key || "")
      }

      if (paymentRes.ok) {
        const paymentData = await paymentRes.json()
        setPaymentMethods(paymentData)
      }

      if (deliveryRes.ok) {
        const deliveryData = await deliveryRes.json()
        setDeliveryRules(deliveryData)
      }
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }

  // Carregar categorias para filtro de impressão
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await fetch("/api/products?include_inactive=1")
        if (res.ok) {
          const data = await res.json()
          const cats = Array.from(
            new Set(
              (data || [])
                .map((p: any) => p.category)
                .filter((c: string | null | undefined) => typeof c === "string" && c.trim().length > 0),
            ),
          ).sort()
          setCategories(cats)
          if (!selectedCategories.length && cats.length) {
            setSelectedCategories(cats)
          }
        }
      } catch (error) {
        console.error("Error loading categories:", error)
      }
    }
    loadCategories()
  }, [selectedCategories.length])

  async function handleSaveRestaurant(e: React.FormEvent) {
    e.preventDefault()

    if (!restaurant) return

    try {
      const etaMin = deliveryEtaMin.trim() === "" ? null : Number(deliveryEtaMin)
      const etaMax = deliveryEtaMax.trim() === "" ? null : Number(deliveryEtaMax)

      if (etaMin !== null && (!Number.isFinite(etaMin) || etaMin < 0 || !Number.isInteger(etaMin))) {
        alert("Tempo mínimo deve ser um número inteiro (minutos).")
        return
      }
      if (etaMax !== null && (!Number.isFinite(etaMax) || etaMax < 0 || !Number.isInteger(etaMax))) {
        alert("Tempo máximo deve ser um número inteiro (minutos).")
        return
      }
      if (etaMin !== null && etaMax !== null && etaMax < etaMin) {
        alert("Tempo máximo não pode ser menor que o tempo mínimo.")
        return
      }

      const normalizedPixKeyType = pixKeyType.trim() === "" ? null : pixKeyType.trim().toUpperCase()
      const rawPixKey = pixKey.trim()

      if (normalizedPixKeyType && rawPixKey === "") {
        alert("Preencha a chave Pix.")
        return
      }
      if (!normalizedPixKeyType && rawPixKey !== "") {
        alert("Selecione o tipo da chave Pix.")
        return
      }

      let normalizedPixKey: string | null = rawPixKey === "" ? null : rawPixKey
      if (normalizedPixKeyType && normalizedPixKey) {
        if (normalizedPixKeyType === "PHONE") {
          normalizedPixKey = normalizedPixKey.replace(/\D/g, "").slice(0, 11)
          if (![10, 11].includes(normalizedPixKey.length)) {
            alert("Chave Pix (Telefone) deve ter 10 ou 11 dígitos (DDD + número).")
            return
          }
        } else if (normalizedPixKeyType === "CPF") {
          normalizedPixKey = normalizedPixKey.replace(/\D/g, "").slice(0, 11)
          if (normalizedPixKey.length !== 11) {
            alert("Chave Pix (CPF) deve ter 11 dígitos (apenas números).")
            return
          }
        } else if (normalizedPixKeyType === "CNPJ") {
          normalizedPixKey = normalizedPixKey.replace(/\D/g, "").slice(0, 14)
          if (normalizedPixKey.length !== 14) {
            alert("Chave Pix (CNPJ) deve ter 14 dígitos (apenas números).")
            return
          }
        } else if (normalizedPixKeyType === "EMAIL") {
          if (!normalizedPixKey.includes("@")) {
            alert("Chave Pix (Email) precisa conter '@'.")
            return
          }
        } else if (normalizedPixKeyType === "RANDOM") {
          if (/\s/.test(normalizedPixKey)) {
            alert("Chave Pix (Aleatória) não deve conter espaços.")
            return
          }
          if (normalizedPixKey.length < 10) {
            alert("Chave Pix (Aleatória) parece curta demais.")
            return
          }
        }
      }

      setSaving(true)
      const response = await fetch("/api/restaurant", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          cep_origem: cepOrigem,
          address,
          delivery_eta_min: etaMin,
          delivery_eta_max: etaMax,
          pix_key_type: normalizedPixKeyType,
          pix_key: normalizedPixKey,
        }),
      })

      if (!response.ok) throw new Error("Failed to save restaurant")

      alert("Dados salvos com sucesso!")
    } catch (error) {
      console.error("Error saving restaurant:", error)
      alert("Erro ao salvar dados")
    } finally {
      setSaving(false)
    }
  }

  // -------- Impressão / QZ --------
  useEffect(() => {
    if (typeof window === "undefined") return
    const config = {
      selectedPrinter,
      autoPrint,
      vias,
      encoding,
      codePage,
      sendCustomerPdf,
    }
    localStorage.setItem("printerConfig", JSON.stringify(config))
  }, [selectedPrinter, autoPrint, vias, encoding, codePage, sendCustomerPdf])

  useEffect(() => {
    if (typeof window === "undefined") return
    const model = {
      selectedCategories,
      modalities,
      showHeader,
      showCustomer,
      showPayment,
      showObservations,
      showValues,
      width,
      footerText,
    }
    localStorage.setItem("printerModelConfig", JSON.stringify(model))
  }, [
    selectedCategories,
    modalities,
    showHeader,
    showCustomer,
    showPayment,
    showObservations,
    showValues,
    width,
    footerText,
  ])

  const ensureQzConnection = async () => {
    const qz = (typeof window !== "undefined" && (window as any).qz) || null
    if (!qz) throw new Error("QZ Tray não carregado. Verifique a instalação.")
    if (!qz.websocket.isActive()) {
      await qz.websocket.connect()
    }
    return qz
  }

  const handleListPrinters = async () => {
    try {
      setIsListingPrinters(true)
      const qz = await ensureQzConnection()
      const list = await qz.printers.find()
      setPrinters(list || [])
    } catch (err: any) {
      alert(err?.message || "Erro ao listar impressoras. Certifique-se de que o QZ Tray está aberto.")
    } finally {
      setIsListingPrinters(false)
    }
  }

  const handleTestPrint = async () => {
    if (!selectedPrinter || selectedPrinter === "__none__") {
      alert("Selecione uma impressora antes de testar.")
      return
    }
    try {
      setIsTestingPrint(true)
      const viasNumber = Math.max(1, Number(vias) || 1)
      const linhas = [
        "SUPERSOLUCAO",
        "-----------------------------",
        "1x X-BURGER",
        "  + Bacon",
        "  + Queijo",
        "  Obs: Sem observação",
        "",
        "Obrigado!",
      ]
      await printCupom(selectedPrinter, linhas, viasNumber)
      alert("Teste enviado para a impressora.")
    } catch (err: any) {
      console.error("Erro ao imprimir teste", err)
      alert(err?.message || "Erro ao imprimir teste.")
    } finally {
      setIsTestingPrint(false)
    }
  }

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]))
  }

  const selectAllCategories = (checked: boolean) => {
    if (checked) setSelectedCategories(categories)
    else setSelectedCategories([])
  }

  const sampleOrder = {
    order_number: 2193,
    tipo_pedido: "CONSUMO NO LOCAL",
    created_at: new Date().toISOString(),
    items: [
      { product_name: "Água", quantity: 1, total_price: 5, addons: [{ name: "Gás Crystal 500ml", quantity: 1 }] },
      {
        product_name: "Smash Burguer",
        quantity: 1,
        total_price: 28,
        addons: [{ name: "Molho Mostarda e Mel", quantity: 1 }],
      },
      { product_name: "Batata Frita Crocante", quantity: 2, total_price: 16, addons: [] },
    ],
    customer: { name: "Cliente Teste", phone: "(00) 0000-0000", notes: "Quantidade de pedidos: 06" },
    payment_method: "Dinheiro",
    subtotal: 49,
    total: 49,
    troco_para: null,
    notes: "",
  }

  const buildPreview = () => {
    const col = width === "48" ? 48 : 32
    const sep = "-".repeat(col)
    const lines: string[] = []

    if (showHeader) {
      lines.push(sampleOrder.tipo_pedido)
      lines.push(sep)
      lines.push(new Date(sampleOrder.created_at).toLocaleString("pt-BR"))
      lines.push("Gui-dogs Itatiba")
      lines.push(sep)
    }

    lines.push(`Pedido ${sampleOrder.order_number}`)
    lines.push("Itens")
    sampleOrder.items.forEach((it) => {
      const line = `${it.quantity}x ${it.product_name}`
      if (showValues) {
        const price = `R$ ${Number(it.total_price).toFixed(2)}`
        const spaces = Math.max(1, col - line.length - price.length)
        lines.push(line + " ".repeat(spaces) + price)
      } else {
        lines.push(line)
      }
      if (it.addons?.length) {
        it.addons.forEach((ad: any) => lines.push(`  (${ad.quantity}) ${ad.name}`))
      }
      lines.push("-------")
    })

    if (showCustomer) {
      lines.push("Cliente")
      lines.push(`Nome: ${sampleOrder.customer.name}`)
      lines.push(`Telefone: ${sampleOrder.customer.phone}`)
      if (sampleOrder.customer.notes) lines.push(sampleOrder.customer.notes)
      lines.push(sep)
    }

    if (showPayment) {
      lines.push("Pagamento")
      lines.push(`Forma de Pagamento: ${sampleOrder.payment_method}`)
      lines.push(sep)
    }

    if (showValues) {
      lines.push(`Subtotal: R$ ${sampleOrder.subtotal.toFixed(2)}`)
      lines.push(`Total:    R$ ${sampleOrder.total.toFixed(2)}`)
      lines.push(sep)
    }

    if (showObservations && sampleOrder.notes) {
      lines.push("Observações")
      lines.push(sampleOrder.notes)
      lines.push(sep)
    }

    if (footerText.trim()) lines.push(footerText.trim())

    return lines.join("\n")
  }

  function handleEditPaymentMethod(method: PaymentMethod) {
    setEditingPaymentMethod(method)
    setPaymentDialogOpen(true)
  }

  function handleDeletePayment(method: PaymentMethod) {
    setPaymentToDelete(method)
    setDeletePaymentDialogOpen(true)
  }

  function handleCreatePaymentMethod() {
    setEditingPaymentMethod(null)
    setPaymentDialogOpen(true)
  }

  function handlePaymentDialogClose(saved: boolean) {
    setPaymentDialogOpen(false)
    setEditingPaymentMethod(null)
    if (saved) {
      loadData()
    }
  }

  async function confirmDeletePayment() {
    if (!paymentToDelete) return
    try {
      setDeletingPayment(true)
      const response = await fetch(`/api/payment-methods/${paymentToDelete.id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete payment method")
      loadData()
      setDeletePaymentDialogOpen(false)
      setPaymentToDelete(null)
    } catch (error) {
      console.error("Error deleting payment method:", error)
      alert("Erro ao excluir forma de pagamento")
    } finally {
      setDeletingPayment(false)
    }
  }

  function handleEditDeliveryRule(rule: DeliveryRule) {
    setEditingDeliveryRule(rule)
    setDeliveryDialogOpen(true)
  }

  function handleCreateDeliveryRule() {
    setEditingDeliveryRule(null)
    setDeliveryDialogOpen(true)
  }

  function handleDeliveryDialogClose(saved: boolean) {
    setDeliveryDialogOpen(false)
    setEditingDeliveryRule(null)
    if (saved) {
      loadData()
    }
  }

  function handleDeleteDeliveryRule(rule: DeliveryRule) {
    setRuleToDelete(rule)
    setDeleteRuleDialogOpen(true)
  }

  async function confirmDeleteRule() {
    if (!ruleToDelete) return
    try {
      setDeletingRule(true)
      const response = await fetch(`/api/delivery-rules/${ruleToDelete.id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete rule")
      loadData()
      setDeleteRuleDialogOpen(false)
      setRuleToDelete(null)
    } catch (error) {
      console.error("Error deleting rule:", error)
      alert("Erro ao excluir regra")
    } finally {
      setDeletingRule(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Configurações</h1>
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground mt-2">Configurações do sistema e restaurante</p>
        </div>

      <Tabs defaultValue="restaurant" className="space-y-4">
        <TabsList>
          <TabsTrigger value="restaurant">Estabelecimento</TabsTrigger>
          <TabsTrigger value="payment">Formas de pagamento</TabsTrigger>
          <TabsTrigger value="delivery">Regras de entrega</TabsTrigger>
          <TabsTrigger value="stock">Estoque</TabsTrigger>
          <TabsTrigger value="printer">Impressão</TabsTrigger>
        </TabsList>

        <TabsContent value="restaurant">
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Dados do estabelecimento</h2>
            <form onSubmit={handleSaveRestaurant} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do estabelecimento *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label>CEP de origem *</Label>
                <Input value={cepOrigem} onChange={(e) => setCepOrigem(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label>Endereço completo *</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} required />
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Entrega</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tempo mínimo (min)</Label>
                    <Input
                      inputMode="numeric"
                      value={deliveryEtaMin}
                      onChange={(e) => setDeliveryEtaMin(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
                      placeholder="Ex: 30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tempo máximo (min)</Label>
                    <Input
                      inputMode="numeric"
                      value={deliveryEtaMax}
                      onChange={(e) => setDeliveryEtaMax(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
                      placeholder="Ex: 40"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {deliveryEtaMin && deliveryEtaMax
                    ? `Estimativa atual: ${deliveryEtaMin}–${deliveryEtaMax} min`
                    : "Defina uma estimativa para informar ao cliente (ex: 30–40 min)."}
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Pix (somente admin)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de chave Pix</Label>
                    <Select
                      value={pixKeyType}
                      onValueChange={(v) => {
                        setPixKeyType(v)
                        setPixKey("")
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PHONE">Telefone</SelectItem>
                        <SelectItem value="EMAIL">Email</SelectItem>
                        <SelectItem value="CPF">CPF</SelectItem>
                        <SelectItem value="CNPJ">CNPJ</SelectItem>
                        <SelectItem value="RANDOM">Chave aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Chave Pix</Label>
                    <Input
                      value={pixKey}
                      onChange={(e) => {
                        const next = e.target.value
                        if (pixKeyType === "PHONE") return setPixKey(next.replace(/\D/g, "").slice(0, 11))
                        if (pixKeyType === "CPF") return setPixKey(next.replace(/\D/g, "").slice(0, 11))
                        if (pixKeyType === "CNPJ") return setPixKey(next.replace(/\D/g, "").slice(0, 14))
                        return setPixKey(next)
                      }}
                      placeholder={
                        pixKeyType === "PHONE"
                          ? "DDD + número (10 ou 11 dígitos)"
                          : pixKeyType === "CPF"
                            ? "11 dígitos (somente números)"
                            : pixKeyType === "CNPJ"
                              ? "14 dígitos (somente números)"
                              : pixKeyType === "EMAIL"
                                ? "email@dominio.com"
                                : pixKeyType === "RANDOM"
                                  ? "Chave aleatória (sem espaços)"
                                  : "Selecione o tipo primeiro"
                      }
                      disabled={!pixKeyType}
                    />
                    <p className="text-xs text-muted-foreground">
                      {pixKeyType === "PHONE" && "Telefone para Pix: apenas DDD + número (com ou sem 9º dígito)."}
                      {pixKeyType === "EMAIL" && "Validação simples: precisa conter '@'."}
                      {pixKeyType === "CPF" && "CPF: 11 dígitos, apenas números."}
                      {pixKeyType === "CNPJ" && "CNPJ: 14 dígitos, apenas números."}
                      {pixKeyType === "RANDOM" && "Chave aleatória: código gerado pelo banco (evite espaços)."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="payment">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Formas de pagamento</h2>
              <Button onClick={handleCreatePaymentMethod}>
                <Plus className="h-4 w-4 mr-2" />
                Nova forma
              </Button>
            </div>

            <div className="border rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Nome</th>
                    <th className="text-center p-3 font-medium">Dias para receber</th>
                    <th className="text-center p-3 font-medium">Ativo</th>
                    <th className="text-center p-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentMethods.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-muted-foreground">
                        Nenhuma forma de pagamento cadastrada
                      </td>
                    </tr>
                  ) : (
                    paymentMethods.map((method) => (
                      <tr key={method.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3">{method.name}</td>
                        <td className="p-3 text-center">{method.settlement_days}</td>
                        <td className="p-3 text-center">{method.is_active ? "Sim" : "Não"}</td>
                        <td className="p-3 text-center">
                          <Button variant="ghost" size="sm" onClick={() => handleEditPaymentMethod(method)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePayment(method)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="delivery">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">Regras de taxa de entrega</h2>
                <p className="text-sm text-muted-foreground">
                  Regras por bairro têm prioridade; se não houver, aplica a regra por distância.
                </p>
              </div>
              <Button onClick={handleCreateDeliveryRule}>
                <Plus className="h-4 w-4 mr-2" />
                Nova regra
              </Button>
            </div>

            {/* Regras por bairro */}
            <div className="border rounded-lg">
              <div className="p-3 border-b bg-muted/40">
                <h3 className="font-semibold">Regras por bairro</h3>
                <p className="text-xs text-muted-foreground">
                  Se houver correspondência de bairro, ela será usada antes da distância.
                </p>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Bairro</th>
                    <th className="text-right p-3 font-medium">Taxa (R$)</th>
                    <th className="text-center p-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryRules.filter((rule) => rule.neighborhood).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-8 text-muted-foreground">
                        Nenhuma regra por bairro cadastrada
                      </td>
                    </tr>
                  ) : (
                    deliveryRules
                      .filter((rule) => rule.neighborhood)
                      .map((rule) => (
                        <tr key={rule.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-3">{rule.neighborhood}</td>
                          <td className="p-3 text-right">R$ {rule.fee.toFixed(2)}</td>
                          <td className="p-3 text-center">
                            <Button variant="ghost" size="sm" onClick={() => handleEditDeliveryRule(rule)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteDeliveryRule(rule)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Regras por distância */}
            <div className="border rounded-lg">
              <div className="p-3 border-b bg-muted/40">
                <h3 className="font-semibold">Regras por distância</h3>
                <p className="text-xs text-muted-foreground">Usadas apenas se nenhuma regra de bairro corresponder.</p>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">De (km)</th>
                    <th className="text-left p-3 font-medium">Até (km)</th>
                    <th className="text-right p-3 font-medium">Taxa (R$)</th>
                    <th className="text-center p-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryRules.filter((rule) => !rule.neighborhood).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-muted-foreground">
                        Nenhuma regra por distância cadastrada
                      </td>
                    </tr>
                  ) : (
                    deliveryRules
                      .filter((rule) => !rule.neighborhood)
                      .map((rule) => (
                        <tr key={rule.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-3">{rule.from_km}</td>
                          <td className="p-3">{rule.to_km}</td>
                          <td className="p-3 text-right">R$ {rule.fee.toFixed(2)}</td>
                          <td className="p-3 text-center">
                            <Button variant="ghost" size="sm" onClick={() => handleEditDeliveryRule(rule)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteDeliveryRule(rule)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stock">
          <StockManagementTab />
        </TabsContent>

        <TabsContent value="printer">
          <div className="border rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Impressão (QZ Tray)</h2>
                <p className="text-sm text-muted-foreground">Configure o modelo do cupom, filtros e teste.</p>
              </div>
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <Checkbox checked={autoPrint} onCheckedChange={(v) => setAutoPrint(Boolean(v))} />
                  Imprimir automaticamente ao entrar em produção
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={sendCustomerPdf} onCheckedChange={(v) => setSendCustomerPdf(Boolean(v))} />
                  Enviar PDF do pedido para o cliente
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Impressora padrão</Label>
                    <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione ou liste impressoras" />
                      </SelectTrigger>
                      <SelectContent>
                        {printers.length === 0 && (
                          <SelectItem value="__none__">{isListingPrinters ? "Carregando..." : "Nenhuma encontrada"}</SelectItem>
                        )}
                        {printers.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={handleListPrinters} disabled={isListingPrinters}>
                      {isListingPrinters ? "Listando..." : "Listar impressoras"}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Número de vias</Label>
                    <Input
                      inputMode="numeric"
                      value={vias}
                      onChange={(e) => setVias(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
                      placeholder="Ex: 2"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Largura</Label>
                    <Select value={width} onValueChange={(v) => setWidth(v as "32" | "48")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="32">32 col</SelectItem>
                        <SelectItem value="48">48 col</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Acentos</Label>
                    <Select
                      value={encoding}
                      onValueChange={(value) => {
                        setEncoding(value)
                        const option = charsetOptions.find((opt) => opt.encoding === value)
                        if (option) setCodePage(option.codePage)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {charsetOptions.map((opt) => (
                          <SelectItem key={opt.encoding} value={opt.encoding}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Se os acentos saírem errados, teste outra opção.
                    </p>
                  </div>
                </div>

                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Filtrar pedidos</h3>
                    <p className="text-xs text-muted-foreground">Escolha quais pedidos imprimem.</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { key: "balcao", label: "Consumo no local" },
                      { key: "retirada", label: "Retirada" },
                      { key: "entrega", label: "Entrega" },
                      { key: "comanda", label: "Comanda" },
                    ].map((m) => (
                      <label key={m.key} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={(modalities as any)[m.key]}
                          onCheckedChange={(v) =>
                            setModalities((prev) => ({ ...prev, [m.key]: Boolean(v) }))
                          }
                        />
                        {m.label}
                      </label>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">Categorias de itens</h4>
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={selectedCategories.length === categories.length && categories.length > 0}
                          onCheckedChange={(v) => selectAllCategories(Boolean(v))}
                        />
                        Selecionar todos
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {categories.length === 0 && (
                        <span className="text-xs text-muted-foreground">Nenhuma categoria carregada.</span>
                      )}
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleCategory(cat)}
                          className={`px-3 py-2 rounded-full border text-sm ${
                            selectedCategories.includes(cat)
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold">Layout do cupom</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={showHeader} onCheckedChange={(v) => setShowHeader(Boolean(v))} />
                      Exibir cabeçalho (nome/data)
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={showCustomer} onCheckedChange={(v) => setShowCustomer(Boolean(v))} />
                      Incluir informações do cliente
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={showPayment} onCheckedChange={(v) => setShowPayment(Boolean(v))} />
                      Incluir pagamento
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={showObservations} onCheckedChange={(v) => setShowObservations(Boolean(v))} />
                      Incluir observações
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={showValues} onCheckedChange={(v) => setShowValues(Boolean(v))} />
                      Incluir valores (itens e totais)
                    </label>
                  </div>
                  <div className="space-y-2">
                    <Label>Rodapé</Label>
                    <Textarea
                      placeholder="Mensagem personalizada (opcional)"
                      value={footerText}
                      onChange={(e) => setFooterText(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleListPrinters} disabled={isListingPrinters}>
                      {isListingPrinters ? "Listando..." : "Atualizar impressoras"}
                    </Button>
                    <Button onClick={handleTestPrint} disabled={isTestingPrint || !selectedPrinter || selectedPrinter === "__none__"}>
                      {isTestingPrint ? "Imprimindo..." : "Imprimir teste"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Deixe o QZ Tray aberto e autorize o site uma vez (marque “Remember this decision”).
                  </p>
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-amber-50">
                <h4 className="font-semibold mb-2 text-sm">Preview</h4>
                <div className="border border-dashed rounded-md bg-white p-3">
                  <pre className="text-xs font-mono whitespace-pre-wrap leading-5">{buildPreview()}</pre>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <PaymentMethodFormDialog
        open={paymentDialogOpen}
        paymentMethod={editingPaymentMethod}
        onClose={handlePaymentDialogClose}
      />

      <DeliveryRuleFormDialog
        open={deliveryDialogOpen}
        deliveryRule={editingDeliveryRule}
        onClose={handleDeliveryDialogClose}
      />
      </div>

      <AlertDialog open={deleteRuleDialogOpen} onOpenChange={setDeleteRuleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar a regra{" "}
              <strong>
                {ruleToDelete?.neighborhood
                  ? `de bairro ${ruleToDelete.neighborhood}`
                  : `de distância ${ruleToDelete?.from_km || ""}-${ruleToDelete?.to_km || ""} km`}
              </strong>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingRule}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRule} disabled={deletingRule} variant="destructive">
              {deletingRule ? "Deletando..." : "Deletar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deletePaymentDialogOpen} onOpenChange={setDeletePaymentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar a forma de pagamento{" "}
              <strong>{paymentToDelete?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingPayment}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePayment} disabled={deletingPayment} variant="destructive">
              {deletingPayment ? "Deletando..." : "Deletar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
