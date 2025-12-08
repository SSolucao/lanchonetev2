"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Pencil, Trash2, TrendingDown, TrendingUp } from "lucide-react"
import type { StockItem } from "@/src/domain/types"
import { StockItemFormDialog } from "./StockItemFormDialog"

export function StockManagementTab() {
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<StockItem | null>(null)

  useEffect(() => {
    loadStockItems()
  }, [])

  async function loadStockItems() {
    try {
      setLoading(true)
      const response = await fetch("/api/stock-items")
      if (response.ok) {
        const data = await response.json()
        setStockItems(data)
      }
    } catch (error) {
      console.error("Error loading stock items:", error)
    } finally {
      setLoading(false)
    }
  }

  function handleCreate() {
    setEditingItem(null)
    setDialogOpen(true)
  }

  function handleEdit(item: StockItem) {
    setEditingItem(item)
    setDialogOpen(true)
  }

  function handleDialogClose(saved: boolean) {
    setDialogOpen(false)
    setEditingItem(null)
    if (saved) {
      loadStockItems()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este item?")) return

    try {
      const response = await fetch(`/api/stock-items/${id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete")
      loadStockItems()
    } catch (error) {
      console.error("Error deleting stock item:", error)
      alert("Erro ao excluir item")
    }
  }

  function getStockStatus(item: StockItem) {
    if (item.current_qty <= item.min_qty) {
      return { icon: TrendingDown, color: "text-red-600", label: "Estoque baixo" }
    }
    return { icon: TrendingUp, color: "text-green-600", label: "OK" }
  }

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Itens de Estoque</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie a matéria-prima e itens contáveis do seu estoque
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo item
        </Button>
      </div>

      <div className="border rounded-lg">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Nome</th>
              <th className="text-center p-3 font-medium">Unidade</th>
              <th className="text-right p-3 font-medium">Qtd. Atual</th>
              <th className="text-right p-3 font-medium">Qtd. Mínima</th>
              <th className="text-center p-3 font-medium">Status</th>
              <th className="text-center p-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {stockItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum item cadastrado
                </td>
              </tr>
            ) : (
              stockItems.map((item) => {
                const status = getStockStatus(item)
                const StatusIcon = status.icon
                return (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        {item.notes && <div className="text-sm text-muted-foreground">{item.notes}</div>}
                      </div>
                    </td>
                    <td className="p-3 text-center">{item.unit}</td>
                    <td className="p-3 text-right">{item.current_qty}</td>
                    <td className="p-3 text-right">{item.min_qty}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <StatusIcon className={`h-4 w-4 ${status.color}`} />
                        <span className={`text-sm ${status.color}`}>{status.label}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <StockItemFormDialog open={dialogOpen} stockItem={editingItem} onClose={handleDialogClose} />
    </div>
  )
}
