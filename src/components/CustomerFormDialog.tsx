"use client"

import type React from "react"

import { useState, useEffect } from "react"
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
}

export function CustomerFormDialog({ open, customer, onClose }: CustomerFormDialogProps) {
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
        phone: phone ? unformatNumbers(phone) : null,
        cep: cep ? unformatNumbers(cep) : null,
        street: street || null,
        number: number || null,
        neighborhood: neighborhood || null,
        city: city || null,
        complement: complement || null,
        notes: notes || null,
      }

      const url = customer ? `/api/customers/${customer.id}` : "/api/customers"
      const method = customer ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) throw new Error("Failed to save customer")

      onClose(true)
    } catch (error) {
      console.error("Error saving customer:", error)
      alert("Erro ao salvar cliente")
    } finally {
      setLoading(false)
    }
  }

  return (
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
            <Label>Telefone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(11) 98765-4321"
              inputMode="numeric"
            />
          </div>

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
