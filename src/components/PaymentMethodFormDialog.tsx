"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import type { PaymentMethod } from "@/src/domain/types"

interface PaymentMethodFormDialogProps {
  open: boolean
  paymentMethod: PaymentMethod | null
  onClose: (saved: boolean) => void
}

export function PaymentMethodFormDialog({ open, paymentMethod, onClose }: PaymentMethodFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [settlementDays, setSettlementDays] = useState("0")

  useEffect(() => {
    if (open && paymentMethod) {
      setName(paymentMethod.name)
      setIsActive(paymentMethod.is_active)
      setSettlementDays(paymentMethod.settlement_days.toString())
    } else if (open) {
      resetForm()
    }
  }, [open, paymentMethod])

  function resetForm() {
    setName("")
    setIsActive(true)
    setSettlementDays("0")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name) {
      alert("Nome é obrigatório")
      return
    }

    try {
      setLoading(true)

      const body = {
        name,
        is_active: isActive,
        settlement_days: Number.parseInt(settlementDays),
      }

      const url = paymentMethod ? `/api/payment-methods/${paymentMethod.id}` : "/api/payment-methods"
      const method = paymentMethod ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) throw new Error("Failed to save payment method")

      onClose(true)
    } catch (error) {
      console.error("Error saving payment method:", error)
      alert("Erro ao salvar forma de pagamento")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{paymentMethod ? "Editar" : "Nova"} Forma de Pagamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Dinheiro, Pix, Cartão de crédito"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Dias para receber</Label>
            <Input type="number" min="0" value={settlementDays} onChange={(e) => setSettlementDays(e.target.value)} />
            <p className="text-sm text-muted-foreground">Quantos dias até o recebimento (0 = imediato)</p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_active"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked as boolean)}
            />
            <Label htmlFor="is_active" className="cursor-pointer">
              Ativo
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onClose(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
