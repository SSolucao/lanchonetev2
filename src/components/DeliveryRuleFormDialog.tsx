"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { DeliveryRule } from "@/src/domain/types"
import * as XLSX from "xlsx"

type BulkEntry = { neighborhood: string; fee: number }

interface DeliveryRuleFormDialogProps {
  open: boolean
  deliveryRule: DeliveryRule | null
  onClose: (saved: boolean) => void
}

export function DeliveryRuleFormDialog({ open, deliveryRule, onClose }: DeliveryRuleFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [ruleType, setRuleType] = useState<"distance" | "neighborhood">("neighborhood")
  const [fromKm, setFromKm] = useState("")
  const [toKm, setToKm] = useState("")
  const [bulkNeighborhoods, setBulkNeighborhoods] = useState("")
  const [bulkEntries, setBulkEntries] = useState<BulkEntry[]>([])
  const [bulkErrors, setBulkErrors] = useState<string[]>([])
  const [bulkFileName, setBulkFileName] = useState("")
  const [neighborhood, setNeighborhood] = useState("")
  const [fee, setFee] = useState("")

  useEffect(() => {
    if (open && deliveryRule) {
      if (deliveryRule.neighborhood) {
        setRuleType("neighborhood")
        setNeighborhood(deliveryRule.neighborhood)
        setBulkNeighborhoods("")
        setBulkEntries([])
        setBulkErrors([])
        setBulkFileName("")
        setFromKm("")
        setToKm("")
      } else {
        setRuleType("distance")
        setFromKm(deliveryRule.from_km?.toString() || "")
        setToKm(deliveryRule.to_km?.toString() || "")
        setBulkNeighborhoods("")
        setBulkEntries([])
        setBulkErrors([])
        setBulkFileName("")
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
    setBulkNeighborhoods("")
    setBulkEntries([])
    setBulkErrors([])
    setBulkFileName("")
    setNeighborhood("")
    setFee("")
  }

  function parseFee(value: string) {
    const normalized = value.replace(",", ".").trim()
    const parsed = Number.parseFloat(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }

  function parseBulkText(value: string) {
    const entries: BulkEntry[] = []
    const errors: string[] = []

    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line, index) => {
        const parts = line.split(/[;,|\t]/).map((part) => part.trim())
        const name = parts[0]
        const feeValue = parts[1]
        if (!name || !feeValue) {
          errors.push(`Linha ${index + 1}: formato inválido`)
          return
        }
        const parsedFee = parseFee(feeValue)
        if (parsedFee === null) {
          errors.push(`Linha ${index + 1}: taxa inválida`)
          return
        }
        entries.push({ neighborhood: name, fee: parsedFee })
      })

    return { entries, errors }
  }

  function mapRowsToEntries(rows: Array<Record<string, any>>) {
    const entries: BulkEntry[] = []
    const errors: string[] = []

    rows.forEach((row, index) => {
      const keys = Object.keys(row)
      const nameKey = keys.find((key) => ["bairro", "nome", "neighborhood"].includes(key.toLowerCase()))
      const feeKey = keys.find((key) => ["taxa", "valor", "fee"].includes(key.toLowerCase()))

      const name = nameKey ? String(row[nameKey] ?? "").trim() : ""
      const feeValue = feeKey ? String(row[feeKey] ?? "").trim() : ""

      if (!name || !feeValue) {
        errors.push(`Linha ${index + 2}: bairro ou taxa ausente`)
        return
      }

      const parsedFee = parseFee(feeValue)
      if (parsedFee === null) {
        errors.push(`Linha ${index + 2}: taxa inválida`)
        return
      }

      entries.push({ neighborhood: name, fee: parsedFee })
    })

    return { entries, errors }
  }

  function handleDownloadTemplate() {
    const rows = [
      { bairro: "Jardim Central", taxa: 10.5 },
      { bairro: "Vila Sao Jose", taxa: 7.0 },
    ]

    const sheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, "Bairros")
    const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    const blob = new Blob([arrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "modelo-bairros.xlsx"
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function handleBulkFileChange(file?: File | null) {
    if (!file) {
      setBulkFileName("")
      setBulkEntries([])
      setBulkErrors([])
      return
    }

    setBulkFileName(file.name)

    const extension = file.name.toLowerCase().split(".").pop()
    const buffer = await file.arrayBuffer()

    if (extension === "csv") {
      const text = new TextDecoder().decode(buffer)
      const { entries, errors } = parseBulkText(text)
      setBulkEntries(entries)
      setBulkErrors(errors)
      return
    }

    if (extension === "xlsx") {
      const workbook = XLSX.read(buffer, { type: "array" })
      const firstSheet = workbook.SheetNames[0]
      if (!firstSheet) {
        setBulkEntries([])
        setBulkErrors(["Arquivo XLSX sem planilha"])
        return
      }
      const sheet = workbook.Sheets[firstSheet]
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Array<Record<string, any>>
      const { entries, errors } = mapRowsToEntries(rows)
      setBulkEntries(entries)
      setBulkErrors(errors)
      return
    }

    setBulkEntries([])
    setBulkErrors(["Formato inválido. Use CSV ou XLSX."])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (ruleType === "distance") {
      if (!fee) {
        alert("Preencha o valor da taxa")
        return
      }
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
      const useBulk = !deliveryRule && (bulkEntries.length > 0 || bulkNeighborhoods.trim().length > 0)
      if (!useBulk && !neighborhood.trim()) {
        alert("Preencha o nome do bairro")
        return
      }
      if (!useBulk && !fee) {
        alert("Preencha o valor da taxa")
        return
      }
    }

    try {
      setLoading(true)

      const useBulk = ruleType === "neighborhood" && !deliveryRule && (bulkEntries.length > 0 || bulkNeighborhoods.trim().length > 0)

      if (useBulk) {
        const manualParsed = parseBulkText(bulkNeighborhoods)
        const entries = [...bulkEntries, ...manualParsed.entries]
        const entryErrors = [...bulkErrors, ...manualParsed.errors]
        const failedEntries: string[] = []
        let successCount = 0

        if (entries.length === 0) {
          alert("Nenhum bairro válido encontrado")
          return
        }

        for (const entry of entries) {
          if (!entry.neighborhood.trim()) {
            failedEntries.push(entry.neighborhood || "Bairro vazio")
            continue
          }

          const response = await fetch("/api/delivery-rules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              neighborhood: entry.neighborhood.trim(),
              fee: entry.fee,
              from_km: null,
              to_km: null,
            }),
          })

          if (!response.ok) {
            failedEntries.push(entry.neighborhood)
            continue
          }

          successCount += 1
        }

        const messages = [`Regras criadas: ${successCount}`]
        if (entryErrors.length > 0) messages.push(`Linhas inválidas: ${entryErrors.length}`)
        if (failedEntries.length > 0) messages.push(`Falha ao salvar: ${failedEntries.join(", ")}`)
        alert(messages.join("\n"))

        if (successCount > 0) {
          onClose(true)
        }
        return
      }

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

  const isBulkMode =
    ruleType === "neighborhood" && !deliveryRule && (bulkEntries.length > 0 || bulkNeighborhoods.trim().length > 0)

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
              {!deliveryRule && (
                <div className="space-y-2">
                  <Label>Cadastro em massa (opcional)</Label>
                  <Button type="button" variant="outline" className="w-fit" onClick={handleDownloadTemplate}>
                    Baixar modelo XLSX
                  </Button>
                  <Input
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={(e) => handleBulkFileChange(e.target.files?.[0])}
                  />
                  {bulkFileName && (
                    <p className="text-xs text-muted-foreground">Arquivo: {bulkFileName}</p>
                  )}
                  <Textarea
                    placeholder="Cole linhas no formato: Bairro;Taxa"
                    value={bulkNeighborhoods}
                    onChange={(e) => setBulkNeighborhoods(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">Exemplo: Jardim Central; 10,50</p>
                  {(bulkEntries.length > 0 || bulkNeighborhoods.trim().length > 0) && (
                    <p className="text-xs text-muted-foreground">
                      Detectados: {bulkEntries.length + parseBulkText(bulkNeighborhoods).entries.length} linhas válidas
                    </p>
                  )}
                  {bulkErrors.length > 0 && (
                    <p className="text-xs text-destructive">Linhas inválidas no arquivo: {bulkErrors.length}</p>
                  )}
                </div>
              )}

              {!(bulkEntries.length > 0 || bulkNeighborhoods.trim().length > 0) && (
                <div className="space-y-2">
                  <Label>Nome do bairro *</Label>
                  <Input
                    type="text"
                    placeholder="Ex: Jardim Sao Jose"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    required
                  />
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

          {ruleType === "distance" || !isBulkMode ? (
            <div className="space-y-2">
              <Label>Taxa (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                required
              />
            </div>
          ) : null}

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
