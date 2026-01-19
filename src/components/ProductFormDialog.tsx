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
import type { Product } from "@/src/domain/types"
import { Plus, X } from "lucide-react"

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

export function ProductFormDialog({ open, product, onClose }: ProductFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState<"UNIT" | "COMBO">("UNIT")
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [price, setPrice] = useState("")
  const [description, setDescription] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [isBalcao, setIsBalcao] = useState(false)
  const [imageUrl, setImageUrl] = useState("")
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  // Combo items
  const [comboItems, setComboItems] = useState<ComboItem[]>([])
  const [availableProducts, setAvailableProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState("")
  const [selectedQuantity, setSelectedQuantity] = useState("1")

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
        setIsBalcao(Boolean(product.is_balcao))
        setImageUrl(product.url_image || "")

        if (product.id && product.type === "COMBO") {
          loadComboItems(product.id)
        }
      } else {
        resetForm()
      }

      loadAvailableProducts()
    }
  }, [open, product])

  function resetForm() {
    setType("UNIT")
    setName("")
    setCategory("")
    setPrice("")
    setDescription("")
    setIsActive(true)
    setIsBalcao(false)
    setImageUrl("")
    setComboItems([])
    setSelectedProductId("")
    setSelectedQuantity("1")
  }

  async function handleImageChange(file?: File) {
    if (!file) return
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      alert("Formato de imagem nao suportado. Use PNG, JPG ou WEBP.")
      return
    }
    try {
      setIsUploadingImage(true)
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/products/upload-image", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.error || "Falha ao enviar imagem")
      }

      const data = await response.json()
      if (data?.url) {
        setImageUrl(data.url)
      }
    } catch (error) {
      console.error("Error uploading product image:", error)
      alert("Erro ao enviar imagem. Tente novamente.")
    } finally {
      setIsUploadingImage(false)
    }
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
        is_balcao: isBalcao,
        url_image: imageUrl || null,
        combo_items:
          type === "COMBO"
            ? comboItems.map((item) => ({
                product_id: item.product_id,
                quantity: item.quantity,
              }))
            : [],
        recipe_items: [],
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
            <Select value={category} onValueChange={(v) => setCategory(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Lanches">Lanches</SelectItem>
                <SelectItem value="Hotdog">Hotdog</SelectItem>
                <SelectItem value="Porções">Porções</SelectItem>
                <SelectItem value="Bebidas">Bebidas</SelectItem>
                <SelectItem value="Sobremesas">Sobremesas</SelectItem>
                <SelectItem value="Doces">Doces</SelectItem>
                <SelectItem value="Outros">Outros</SelectItem>
              </SelectContent>
            </Select>
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

          <div className="space-y-2">
            <Label>Imagem do produto (para IA)</Label>
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => handleImageChange(e.target.files?.[0])}
              disabled={isUploadingImage}
            />
            {imageUrl && (
              <div className="flex items-center gap-2 text-sm">
                <a className="text-primary underline" href={imageUrl} target="_blank" rel="noreferrer">
                  Ver imagem atual
                </a>
                <Button type="button" variant="ghost" size="sm" onClick={() => setImageUrl("")}>
                  Remover
                </Button>
              </div>
            )}
            {isUploadingImage && <p className="text-xs text-muted-foreground">Enviando imagem...</p>}
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
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_balcao"
              checked={isBalcao}
              onCheckedChange={(checked) => setIsBalcao(checked as boolean)}
            />
            <Label htmlFor="is_balcao" className="cursor-pointer">
              Disponivel no Balcao
            </Label>
          </div>

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
