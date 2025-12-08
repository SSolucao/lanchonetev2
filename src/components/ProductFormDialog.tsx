"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Product, StockItem } from "@/src/domain/types"
import { Plus, X } from "lucide-react"
import { useAuth } from "@/src/context/AuthContext"

interface ProductFormDialogProps {
  open: boolean
  product: Product | null
  onClose: (saved: boolean) => void
}

interface ComboItem {
  product_id: string
  product_name: string
  quantity: number
}

interface RecipeItem {
  stock_item_id: string
  stock_item_name: string
  quantity: number
  unit: string
}

export function ProductFormDialog({ open, product, onClose }: ProductFormDialogProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState<"UNIT" | "COMBO">("UNIT")
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [price, setPrice] = useState("")
  const [description, setDescription] = useState("")
  const [isActive, setIsActive] = useState(true)

  // Combo items
  const [comboItems, setComboItems] = useState<ComboItem[]>([])
  const [availableProducts, setAvailableProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState("")
  const [selectedQuantity, setSelectedQuantity] = useState("1")

  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([])
  const [availableStockItems, setAvailableStockItems] = useState<StockItem[]>([])
  const [selectedStockItemId, setSelectedStockItemId] = useState("")
  const [selectedRecipeQuantity, setSelectedRecipeQuantity] = useState("1")

  useEffect(() => {
    if (open) {
      if (product) {
        console.log("[v0] Loading product for edit:", product.id)
        setType(product.type)
        setName(product.name)
        setCategory(product.category || "")
        setPrice(product.price.toString())
        setDescription(product.description || "")
        setIsActive(product.is_active)

        if (product.id) {
          if (product.type === "COMBO") {
            loadComboItems(product.id)
          } else {
            loadRecipeItems(product.id)
          }
        }
      } else {
        resetForm()
      }

      loadAvailableProducts()
      loadAvailableStockItems()
    }
  }, [open, product])

  function resetForm() {
    setType("UNIT")
    setName("")
    setCategory("")
    setPrice("")
    setDescription("")
    setIsActive(true)
    setComboItems([])
    setSelectedProductId("")
    setSelectedQuantity("1")
    setRecipeItems([])
    setSelectedStockItemId("")
    setSelectedRecipeQuantity("1")
  }

  async function loadAvailableProducts() {
    try {
      const response = await fetch("/api/products?type=UNIT")
      if (!response.ok) throw new Error("Failed to load products")
      const data = await response.json()
      setAvailableProducts(data.filter((p: Product) => p.is_active))
    } catch (error) {
      console.error("Error loading products:", error)
    }
  }

  async function loadComboItems(comboId: string) {
    if (!comboId || comboId === "undefined") {
      console.error("[v0] Invalid combo ID:", comboId)
      return
    }

    try {
      console.log("[v0] Loading combo items for:", comboId)
      const response = await fetch(`/api/products/${comboId}/combo-items`)
      if (!response.ok) throw new Error("Failed to load combo items")
      const data = await response.json()
      setComboItems(data)
    } catch (error) {
      console.error("Error loading combo items:", error)
    }
  }

  function handleAddComboItem() {
    if (!selectedProductId || !selectedQuantity) return

    const product = availableProducts.find((p) => p.id === selectedProductId)
    if (!product) return

    const existing = comboItems.find((item) => item.product_id === selectedProductId)
    if (existing) {
      alert("Este produto já está no combo")
      return
    }

    setComboItems([
      ...comboItems,
      {
        product_id: selectedProductId,
        product_name: product.name,
        quantity: Number.parseInt(selectedQuantity),
      },
    ])

    setSelectedProductId("")
    setSelectedQuantity("1")
  }

  function handleRemoveComboItem(productId: string) {
    setComboItems(comboItems.filter((item) => item.product_id !== productId))
  }

  async function loadAvailableStockItems() {
    try {
      const response = await fetch("/api/stock-items")
      if (!response.ok) throw new Error("Failed to load stock items")
      const data = await response.json()
      setAvailableStockItems(data.filter((item: StockItem) => item.is_active))
    } catch (error) {
      console.error("Error loading stock items:", error)
    }
  }

  async function loadRecipeItems(productId: string) {
    if (!productId || productId === "undefined") {
      console.error("[v0] Invalid product ID:", productId)
      return
    }

    try {
      console.log("[v0] Loading recipe items for:", productId)
      const response = await fetch(`/api/products/${productId}/recipe`)
      if (!response.ok) throw new Error("Failed to load recipe items")
      const data = await response.json()
      setRecipeItems(data)
    } catch (error) {
      console.error("Error loading recipe items:", error)
    }
  }

  function handleAddRecipeItem() {
    if (!selectedStockItemId || !selectedRecipeQuantity) return

    const stockItem = availableStockItems.find((item) => item.id === selectedStockItemId)
    if (!stockItem) return

    const existing = recipeItems.find((item) => item.stock_item_id === selectedStockItemId)
    if (existing) {
      alert("Este item já está na receita")
      return
    }

    setRecipeItems([
      ...recipeItems,
      {
        stock_item_id: selectedStockItemId,
        stock_item_name: stockItem.name,
        quantity: Number.parseFloat(selectedRecipeQuantity),
        unit: stockItem.unit,
      },
    ])

    setSelectedStockItemId("")
    setSelectedRecipeQuantity("1")
  }

  function handleRemoveRecipeItem(stockItemId: string) {
    setRecipeItems(recipeItems.filter((item) => item.stock_item_id !== stockItemId))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name || !price) {
      alert("Preencha todos os campos obrigatórios")
      return
    }

    if (type === "COMBO" && comboItems.length === 0) {
      alert("Adicione pelo menos um item ao combo")
      return
    }

    try {
      setLoading(true)

      const body = {
        name,
        type,
        category: category || null,
        price: Number.parseFloat(price),
        description: description || null,
        is_active: isActive,
        combo_items:
          type === "COMBO"
            ? comboItems.map((item) => ({
                product_id: item.product_id,
                quantity: item.quantity,
              }))
            : [],
        recipe_items:
          type === "UNIT"
            ? recipeItems.map((item) => ({
                stock_item_id: item.stock_item_id,
                quantity: item.quantity,
              }))
            : [],
      }

      const url = product?.id ? `/api/products/${product.id}` : "/api/products"
      const method = product ? "PUT" : "POST"

      console.log("[v0] Submitting product:", { url, method, productId: product?.id })

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error("[v0] Error response:", errorData)
        throw new Error("Failed to save product")
      }

      onClose(true)
    } catch (error) {
      console.error("Error saving product:", error)
      alert("Erro ao salvar produto")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose(false)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {product ? "Editar" : "Novo"} {type === "UNIT" ? "Produto" : "Combo"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!product && (
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as "UNIT" | "COMBO")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNIT">Produto</SelectItem>
                  <SelectItem value="COMBO">Combo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Preço *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
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

          {type === "UNIT" && (
            <div className="space-y-4 border-t pt-4">
              <div>
                <Label className="text-base font-semibold">Receita do produto</Label>
                <p className="text-sm text-muted-foreground">Adicione os itens de estoque que compõem este produto</p>
              </div>

              <div className="flex gap-2">
                <Select value={selectedStockItemId} onValueChange={setSelectedStockItemId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione um item de estoque" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStockItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={selectedRecipeQuantity}
                  onChange={(e) => setSelectedRecipeQuantity(e.target.value)}
                  className="w-24"
                  placeholder="Qtd"
                />
                <Button type="button" onClick={handleAddRecipeItem} disabled={!selectedStockItemId}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {recipeItems.length > 0 && (
                <div className="border rounded-lg">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-2 text-sm font-medium">Item de estoque</th>
                        <th className="text-center p-2 text-sm font-medium">Quantidade</th>
                        <th className="text-center p-2 text-sm font-medium w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipeItems.map((item) => (
                        <tr key={item.stock_item_id} className="border-b last:border-0">
                          <td className="p-2">{item.stock_item_name}</td>
                          <td className="p-2 text-center">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="p-2 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveRecipeItem(item.stock_item_id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {type === "COMBO" && (
            <div className="space-y-4 border-t pt-4">
              <div>
                <Label className="text-base font-semibold">Itens do combo</Label>
                <p className="text-sm text-muted-foreground">Adicione os produtos que fazem parte deste combo</p>
              </div>

              <div className="flex gap-2">
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="1"
                  value={selectedQuantity}
                  onChange={(e) => setSelectedQuantity(e.target.value)}
                  className="w-20"
                  placeholder="Qtd"
                />
                <Button type="button" onClick={handleAddComboItem} disabled={!selectedProductId}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {comboItems.length > 0 && (
                <div className="border rounded-lg">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-2 text-sm font-medium">Produto</th>
                        <th className="text-center p-2 text-sm font-medium">Quantidade</th>
                        <th className="text-center p-2 text-sm font-medium w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {comboItems.map((item) => (
                        <tr key={item.product_id} className="border-b last:border-0">
                          <td className="p-2">{item.product_name}</td>
                          <td className="p-2 text-center">{item.quantity}</td>
                          <td className="p-2 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveComboItem(item.product_id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
  )
}
