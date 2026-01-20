"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Customer } from "@/src/domain/types"
import { formatPhone, formatCEP, unformatNumbers, fetchAddressFromCEP } from "@/lib/format-utils"

interface CustomerFormDialogProps {
  open: boolean
  customer: Customer | null
  onClose: (saved: boolean) => void
  onSaved?: (customer: Customer) => void
  mode?: "full" | "minimal"
  requireAddress?: boolean
}

export function CustomerFormDialog({
  open,
  customer,
  onClose,
  onSaved,
  mode = "full",
  requireAddress = false,
}: CustomerFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [loadingCEP, setLoadingCEP] = useState(false)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [cep, setCep] = useState("")
  const [street, setStreet] = useState("")
  const [number, setNumber] = useState("")
  const [neighborhood, setNeighborhood] = useState("")
  const [city, setCity] = useState("")
  const [complement, setComplement] = useState("")
  const [notes, setNotes] = useState("")
  const [deliveryFee, setDeliveryFee] = useState("")
  const [deliveryFeeTouched, setDeliveryFeeTouched] = useState(false)
  const [nameConflictOpen, setNameConflictOpen] = useState(false)
  const [nameConflictMatches, setNameConflictMatches] = useState<Customer[]>([])
  const isMinimal = mode === "minimal"
  const lastFeeKey = useRef<string | null>(null)
  const feeRequest = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open && customer) {
      setName(customer.name)
      setPhone(customer.phone ? formatPhone(customer.phone) : "")
      setCep(customer.cep ? formatCEP(customer.cep) : "")
      setStreet(customer.street || "")
      setNumber(customer.number || "")
      setNeighborhood(customer.neighborhood || "")
      setCity(customer.city || "")
      setComplement(customer.complement || "")
      setNotes(customer.notes || "")
      setDeliveryFee(
        typeof customer.delivery_fee_default === "number" ? customer.delivery_fee_default.toFixed(2) : "",
      )
      setDeliveryFeeTouched(false)
      const feeKey = [
        customer.cep ? unformatNumbers(customer.cep) : "",
        customer.street || "",
        customer.number || "",
        customer.neighborhood || "",
        customer.city || "",
      ].join("|")
      lastFeeKey.current = customer.cep ? feeKey : null
    } else if (open) {
      resetForm()
    }
  }, [open, customer])

  function resetForm() {
    setName("")
    setPhone("")
    setCep("")
    setStreet("")
    setNumber("")
    setNeighborhood("")
    setCity("")
    setComplement("")
    setNotes("")
    setDeliveryFee("")
    setDeliveryFeeTouched(false)
    lastFeeKey.current = null
  }

  async function handleCEPChange(value: string) {
    const formatted = formatCEP(value)
    setCep(formatted)

    // If CEP is complete (8 digits), fetch address
    const cleanCEP = unformatNumbers(formatted)
    if (cleanCEP.length === 8) {
      setLoadingCEP(true)
      const addressData = await fetchAddressFromCEP(cleanCEP)
      setLoadingCEP(false)

      if (addressData) {
        setStreet(addressData.logradouro)
        setNeighborhood(addressData.bairro)
        setCity(addressData.localidade)
        // Keep existing complement if user already filled it
        if (!complement) {
          setComplement(addressData.complemento)
        }
      }
    }
  }

  useEffect(() => {
    if (isMinimal || deliveryFeeTouched) return
    const cleanCEP = unformatNumbers(cep)
    if (cleanCEP.length !== 8 || !street || !number || !neighborhood || !city) return

    const feeKey = [cleanCEP, street, number, neighborhood, city].join("|")
    if (lastFeeKey.current === feeKey) return

    const timer = setTimeout(async () => {
      if (feeRequest.current) {
        feeRequest.current.abort()
      }
      const controller = new AbortController()
      feeRequest.current = controller

      try {
        const response = await fetch("/api/customers/preview-delivery-fee", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cep: cleanCEP,
            street,
            number,
            neighborhood,
            city,
          }),
          signal: controller.signal,
        })

        if (!response.ok) return
        const data = await response.json()
        if (data?.success) {
          lastFeeKey.current = feeKey
          setDeliveryFee(Number(data.fee || 0).toFixed(2))
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Error previewing delivery fee:", error)
        }
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [cep, street, number, neighborhood, city, isMinimal, deliveryFeeTouched])

  const submitForm = async (allowDuplicateName = false) => {
    if (!name) {
      alert("Nome é obrigatório")
      return
    }

    if (!phone) {
      alert("Telefone é obrigatório")
      return
    }

    if (
      requireAddress &&
      (!cep || !street || !number || !neighborhood || !city)
    ) {
      alert("Endereço completo é obrigatório para entrega")
      return
    }

    try {
      setLoading(true)

      let cleanPhone = phone ? unformatNumbers(phone) : null
      if (cleanPhone) {
      if (!cleanPhone.startsWith("55")) {
        cleanPhone = `55${cleanPhone}`
      }
      }

      const body: Record<string, any> = {
        name,
        phone: cleanPhone,
        cep: cep ? unformatNumbers(cep) : null,
        street: street || null,
        number: number || null,
        neighborhood: neighborhood || null,
        city: city || null,
        complement: complement || null,
        notes: notes || null,
        allow_duplicate_name: allowDuplicateName,
      }

      if (deliveryFeeTouched && deliveryFee !== "") {
        body.delivery_fee_default = Number.parseFloat(deliveryFee)
      }

      const url = customer ? `/api/customers/${customer.id}` : "/api/customers"
      const method = customer ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        if (response.status === 409 && errorBody?.error === "NAME_EXISTS") {
          setNameConflictMatches(Array.isArray(errorBody?.matches) ? errorBody.matches : [])
          setNameConflictOpen(true)
          return
        }
        if (response.status === 409) {
          throw new Error("PHONE_EXISTS")
        }
        throw new Error(errorBody?.error || "Failed to save customer")
      }

      const savedCustomer = await response.json().catch(() => null)
      if (savedCustomer) {
        onSaved?.(savedCustomer)
      }

      onClose(true)
    } catch (error) {
      console.error("Error saving customer:", error)
      if (error instanceof Error && error.message === "PHONE_EXISTS") {
        alert("Já existe um cliente com este telefone.")
        return
      }
      alert("Erro ao salvar cliente")
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    await submitForm()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={() => onClose(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{customer ? "Editar" : "Novo"} Cliente</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Telefone *</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(11) 98765-4321"
              inputMode="numeric"
              required
            />
          </div>

          {!isMinimal && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input
                    value={cep}
                    onChange={(e) => handleCEPChange(e.target.value)}
                    placeholder="12345-678"
                    inputMode="numeric"
                    disabled={loadingCEP}
                  />
                  {loadingCEP && <p className="text-xs text-muted-foreground">Buscando endereço...</p>}
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Rua</Label>
                <Input value={street} onChange={(e) => setStreet(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input value={number} onChange={(e) => setNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Complemento</Label>
                <Input value={complement} onChange={(e) => setComplement(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>

              <div className="space-y-2">
                <Label>Taxa de entrega padrão (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={deliveryFee}
                  onChange={(e) => {
                    setDeliveryFee(e.target.value)
                    setDeliveryFeeTouched(true)
                  }}
                  placeholder="Automático"
                />
                <p className="text-xs text-muted-foreground">
                  Se deixar em branco, o sistema calcula pela regra de bairro/distância quando o endereço mudar.
                </p>
              </div>
            </>
          )}

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
      <Dialog open={nameConflictOpen} onOpenChange={setNameConflictOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nome já cadastrado</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>Já existe um cliente com esse nome. Deseja continuar mesmo assim?</p>
            {nameConflictMatches.length > 0 && (
              <div className="rounded-md border bg-muted/30 p-3">
                {nameConflictMatches.map((match) => (
                  <div key={match.id} className="flex items-center justify-between gap-2">
                    <span className="font-medium">{match.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {match.phone ? formatPhone(match.phone) : "Sem telefone"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setNameConflictOpen(false)}>
              Voltar
            </Button>
            <Button
              onClick={async () => {
                setNameConflictOpen(false)
                await submitForm(true)
              }}
              disabled={loading}
            >
              Salvar mesmo assim
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
