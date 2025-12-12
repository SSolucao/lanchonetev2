"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

export default function ConfiguracoesPage() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Restaurant form
  const [name, setName] = useState("")
  const [cepOrigem, setCepOrigem] = useState("")
  const [address, setAddress] = useState("")

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

  async function handleSaveRestaurant(e: React.FormEvent) {
    e.preventDefault()

    if (!restaurant) return

    try {
      setSaving(true)
      const response = await fetch("/api/restaurant", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, cep_origem: cepOrigem, address }),
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
