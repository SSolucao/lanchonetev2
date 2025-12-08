"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import type { StockItem, StockUnit } from "@/src/domain/types"

interface StockItemFormDialogProps {
  open: boolean
  stockItem: StockItem | null
  onClose: (saved: boolean) => void
}

const STOCK_UNITS: { value: StockUnit; label: string }[] = [
  { value: "UN", label: "Unidade" },
  { value: "KG", label: "Quilograma" },
  { value: "G", label: "Grama" },
  { value: "L", label: "Litro" },
  { value: "ML", label: "Mililitro" },
  { value: "CX", label: "Caixa" },
  { value: "PCT", label: "Pacote" },
]

export function StockItemFormDialog({ open, stockItem, onClose }: StockItemFormDialogProps) {
  const [name, setName] = useState("")
  const [unit, setUnit] = useState<StockUnit>("UN")
  const [currentQty, setCurrentQty] = useState("0")
  const [minQty, setMinQty] = useState("0")
  const [isActive, setIsActive] = useState(true)
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (stockItem) {
      setName(stockItem.name)
      setUnit(stockItem.unit)
      setCurrentQty(String(stockItem.current_qty))
      setMinQty(String(stockItem.min_qty))
      setIsActive(stockItem.is_active)
      setNotes(stockItem.notes || "")
    } else {
      setName("")
      setUnit("UN")
      setCurrentQty("0")
      setMinQty("0")
      setIsActive(true)
      setNotes("")
    }
  }, [stockItem, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      setSaving(true)

      const data = {
        name,
        unit,
        current_qty: Number.parseFloat(currentQty),
        min_qty: Number.parseFloat(minQty),
        is_active: isActive,
        notes: notes || null,
      }

      const url = stockItem ? `/api/stock-items/${stockItem.id}` : "/api/stock-items"
      const method = stockItem ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error("Failed to save stock item")

      onClose(true)
    } catch (error) {
      console.error("Error saving stock item:", error)
      alert("Erro ao salvar item")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{stockItem ? "Editar Item" : "Novo Item de Estoque"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ex: Pão Hambúrguer" />
          </div>

          <div className="space-y-2">
            <Label>Unidade de medida *</Label>
            <Select value={unit} onValueChange={(value) => setUnit(value as StockUnit)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STOCK_UNITS.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantidade atual *</Label>
              <Input
                type="number"
                step="0.01"
                value={currentQty}
                onChange={(e) => setCurrentQty(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Quantidade mínima *</Label>
              <Input type="number" step="0.01" value={minQty} onChange={(e) => setMinQty(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informações adicionais sobre o item"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="active" checked={isActive} onCheckedChange={(checked) => setIsActive(checked as boolean)} />
            <Label htmlFor="active" className="cursor-pointer">
              Ativo
            </Label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onClose(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
