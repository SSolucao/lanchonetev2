"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { DeliveryRule } from "@/src/domain/types"
import { formatCEP, unformatNumbers, fetchAddressFromCEP } from "@/lib/format-utils"

interface DeliveryRuleFormDialogProps {
  open: boolean
  deliveryRule: DeliveryRule | null
  onClose: (saved: boolean) => void
}

export function DeliveryRuleFormDialog({ open, deliveryRule, onClose }: DeliveryRuleFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [loadingCEP, setLoadingCEP] = useState(false)
  const [ruleType, setRuleType] = useState<"distance" | "neighborhood">("neighborhood")
  const [fromKm, setFromKm] = useState("")
  const [toKm, setToKm] = useState("")
  const [cep, setCep] = useState("")
  const [neighborhood, setNeighborhood] = useState("")
  const [fee, setFee] = useState("")

  useEffect(() => {
    if (open && deliveryRule) {
      if (deliveryRule.neighborhood) {
        setRuleType("neighborhood")
        setNeighborhood(deliveryRule.neighborhood)
        setCep("")
        setFromKm("")
        setToKm("")
      } else {
        setRuleType("distance")
        setFromKm(deliveryRule.from_km?.toString() || "")
        setToKm(deliveryRule.to_km?.toString() || "")
        setCep("")
        setNeighborhood("")
      }
      setFee(deliveryRule.fee.toString())
    } else if (open) {
      resetForm()
    }
  }, [open, deliveryRule])

  function resetForm() {
    setRuleType("neighborhood")
    setFromKm("")
    setToKm("")
    setCep("")
    setNeighborhood("")
    setFee("")
  }

  async function handleCEPChange(value: string) {
    const formatted = formatCEP(value)
    setCep(formatted)

    // Se CEP está completo (8 dígitos), busca o endereço
    const cleanCEP = unformatNumbers(formatted)
    if (cleanCEP.length === 8) {
      setLoadingCEP(true)
      const addressData = await fetchAddressFromCEP(cleanCEP)
      setLoadingCEP(false)

      if (addressData && addressData.bairro) {
        setNeighborhood(addressData.bairro)
      } else {
        alert("CEP não encontrado ou sem informação de bairro")
        setNeighborhood("")
      }
    } else {
      // Se CEP foi apagado, limpa o bairro
      setNeighborhood("")
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!fee) {
      alert("Preencha o valor da taxa")
      return
    }

    if (ruleType === "distance") {
      if (!fromKm || !toKm) {
        alert("Preencha as distâncias mínima e máxima")
        return
      }

      const from = Number.parseFloat(fromKm)
      const to = Number.parseFloat(toKm)

      if (to <= from) {
        alert("Distância máxima deve ser maior que a mínima")
        return
      }
    } else {
      if (!neighborhood.trim()) {
        alert("Preencha o CEP para buscar o bairro")
        return
      }
    }

    try {
      setLoading(true)

      const body =
        ruleType === "distance"
          ? {
              from_km: Number.parseFloat(fromKm),
              to_km: Number.parseFloat(toKm),
              fee: Number.parseFloat(fee),
              neighborhood: null,
            }
          : {
              neighborhood: neighborhood.trim(),
              fee: Number.parseFloat(fee),
              from_km: null,
              to_km: null,
            }

      const url = deliveryRule ? `/api/delivery-rules/${deliveryRule.id}` : "/api/delivery-rules"
      const method = deliveryRule ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) throw new Error("Failed to save delivery rule")

      onClose(true)
    } catch (error) {
      console.error("Error saving delivery rule:", error)
      alert("Erro ao salvar regra de entrega")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{deliveryRule ? "Editar" : "Nova"} Regra de Entrega</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <Label>Tipo de Regra *</Label>
            <RadioGroup value={ruleType} onValueChange={(value) => setRuleType(value as "distance" | "neighborhood")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="neighborhood" id="neighborhood" />
                <Label htmlFor="neighborhood" className="font-normal cursor-pointer">
                  Por Bairro (recomendado)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="distance" id="distance" />
                <Label htmlFor="distance" className="font-normal cursor-pointer">
                  Por Distância (km)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {ruleType === "neighborhood" ? (
            <>
              <div className="space-y-2">
                <Label>CEP do Bairro *</Label>
                <Input
                  type="text"
                  placeholder="12345-678"
                  value={cep}
                  onChange={(e) => handleCEPChange(e.target.value)}
                  inputMode="numeric"
                  disabled={loadingCEP}
                  required
                />
                {loadingCEP && <p className="text-xs text-muted-foreground">Buscando bairro...</p>}
                <p className="text-xs text-muted-foreground">Digite um CEP do bairro para buscar automaticamente</p>
              </div>

              {neighborhood && (
                <div className="space-y-2">
                  <Label>Bairro Encontrado</Label>
                  <Input type="text" value={neighborhood} readOnly className="bg-muted" />
                  <p className="text-xs text-muted-foreground">
                    Este é o bairro que será salvo na regra (conforme ViaCEP)
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Distância mínima (km) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={fromKm}
                  onChange={(e) => setFromKm(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Distância máxima (km) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={toKm}
                  onChange={(e) => setToKm(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Taxa (R$) *</Label>
            <Input type="number" step="0.01" min="0" value={fee} onChange={(e) => setFee(e.target.value)} required />
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
