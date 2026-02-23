"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Customer } from "@/src/domain/types"
import { formatPhone, unformatNumbers } from "@/lib/format-utils"

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
  const [loadingNeighborhoods, setLoadingNeighborhoods] = useState(false)
  const [neighborhoodOptions, setNeighborhoodOptions] = useState<Array<{ id: string; name: string; fee: number }>>([])
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [addressLine, setAddressLine] = useState("")
  const [neighborhood, setNeighborhood] = useState("")
  const [selectedNeighborhoodRuleId, setSelectedNeighborhoodRuleId] = useState("")
  const [neighborhoodSearch, setNeighborhoodSearch] = useState("")
  const [debouncedNeighborhoodSearch, setDebouncedNeighborhoodSearch] = useState("")
  const [nameConflictOpen, setNameConflictOpen] = useState(false)
  const [nameConflictMatches, setNameConflictMatches] = useState<Customer[]>([])
  const isMinimal = mode === "minimal"
  const lastNeighborhoodFetchAt = useRef<number>(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedNeighborhoodSearch(neighborhoodSearch.trim().toLowerCase())
    }, 400)
    return () => clearTimeout(timer)
  }, [neighborhoodSearch])

  useEffect(() => {
    if (open && customer) {
      setName(customer.name)
      setPhone(customer.phone ? formatPhone(customer.phone) : "")
      setAddressLine(customer.address_line || "")
      setNeighborhood(customer.neighborhood || "")
      setSelectedNeighborhoodRuleId(customer.delivery_rule_id || "")
    } else if (open) {
      resetForm()
    }
  }, [open, customer])

  useEffect(() => {
    if (!open || isMinimal) return

    const now = Date.now()
    if (now - lastNeighborhoodFetchAt.current < 10000 && neighborhoodOptions.length > 0) {
      return
    }

    let cancelled = false
    const loadNeighborhoods = async () => {
      try {
        setLoadingNeighborhoods(true)
        const response = await fetch("/api/delivery-rules")
        if (!response.ok) {
          throw new Error("Failed to load neighborhoods")
        }
        const rules = (await response.json()) as Array<{ id: string; neighborhood: string | null; fee: number }>
        const options = rules
          .filter((rule) => Boolean(rule.neighborhood && String(rule.neighborhood).trim()))
          .map((rule) => ({
            id: String(rule.id),
            name: String(rule.neighborhood).trim(),
            fee: Number(rule.fee || 0),
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))

        if (cancelled) return
        setNeighborhoodOptions(options)
        lastNeighborhoodFetchAt.current = Date.now()

        if (customer?.delivery_rule_id) {
          const selected = options.find((option) => option.id === customer.delivery_rule_id)
          if (selected) {
            setNeighborhood(selected.name)
            setSelectedNeighborhoodRuleId(selected.id)
          }
        } else if (customer?.neighborhood) {
          const matched = options.find(
            (option) => option.name.toLowerCase() === String(customer.neighborhood).trim().toLowerCase(),
          )
          if (matched) {
            setNeighborhood(matched.name)
            setSelectedNeighborhoodRuleId(matched.id)
          } else {
            setSelectedNeighborhoodRuleId("")
          }
        }
      } catch (error) {
        console.error("Error loading neighborhoods:", error)
      } finally {
        if (!cancelled) setLoadingNeighborhoods(false)
      }
    }

    loadNeighborhoods()

    return () => {
      cancelled = true
    }
  }, [open, isMinimal, customer, neighborhoodOptions.length])

  function resetForm() {
    setName("")
    setPhone("")
    setAddressLine("")
    setNeighborhood("")
    setSelectedNeighborhoodRuleId("")
    setNeighborhoodSearch("")
    setDebouncedNeighborhoodSearch("")
  }

  const filteredNeighborhoodOptions = neighborhoodOptions.filter((option) => {
    if (!debouncedNeighborhoodSearch) return true
    const feeDot = option.fee.toFixed(2)
    const feeComma = feeDot.replace(".", ",")
    const searchable = `${option.name.toLowerCase()} ${feeDot} ${feeComma} ${Math.round(option.fee)}`
    return searchable.includes(debouncedNeighborhoodSearch)
  })

  const submitForm = async (allowDuplicateName = false) => {
    if (!name) {
      alert("Nome é obrigatório")
      return
    }

    if (!phone) {
      alert("Telefone é obrigatório")
      return
    }

    if (!isMinimal && (!addressLine || !selectedNeighborhoodRuleId || !neighborhood)) {
      alert("Rua e bairro são obrigatórios")
      return
    }

    if (
      requireAddress &&
      (!addressLine || !neighborhood)
    ) {
      alert("Rua e bairro são obrigatórios para entrega")
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
        address_line: addressLine || null,
        neighborhood: neighborhood || null,
        neighborhood_rule_id: selectedNeighborhoodRuleId || null,
        allow_duplicate_name: allowDuplicateName,
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
              <div className="space-y-2">
                <Label>Rua *</Label>
                <Input
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  placeholder="Rua + número + complemento"
                  required={requireAddress}
                />
              </div>

              <div className="space-y-2">
                <Label>Bairro *</Label>
                <Select
                  value={selectedNeighborhoodRuleId}
                  onValueChange={(ruleId) => {
                    setSelectedNeighborhoodRuleId(ruleId)
                    const selected = neighborhoodOptions.find((option) => option.id === ruleId)
                    setNeighborhood(selected?.name || "")
                  }}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={loadingNeighborhoods ? "Carregando bairros..." : "Selecione um bairro"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="sticky top-0 z-10 border-b bg-popover p-2">
                      <Input
                        value={neighborhoodSearch}
                        onChange={(e) => setNeighborhoodSearch(e.target.value)}
                        placeholder="Buscar bairro ou taxa..."
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                    {neighborhoodOptions.length === 0 ? (
                      <SelectItem value="__empty" disabled>
                        Nenhum bairro cadastrado
                      </SelectItem>
                    ) : filteredNeighborhoodOptions.length === 0 ? (
                      <SelectItem value="__no_match" disabled>
                        Nenhum bairro encontrado
                      </SelectItem>
                    ) : (
                      filteredNeighborhoodOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name} - R$ {option.fee.toFixed(2)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {!selectedNeighborhoodRuleId && neighborhood && (
                  <p className="text-xs text-muted-foreground">
                    Bairro atual não está na lista de regras. Selecione um bairro cadastrado.
                  </p>
                )}
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
