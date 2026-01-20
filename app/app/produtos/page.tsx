"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Plus, Search, Pencil, Trash2, X } from "lucide-react"
import type { Product, Addon } from "@/src/domain/types"
import { ProductFormDialog } from "@/src/components/ProductFormDialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<"ALL" | "UNIT" | "COMBO">("ALL")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [addons, setAddons] = useState<Addon[]>([])
  const [addonsLoading, setAddonsLoading] = useState(false)
  const [addonDialogOpen, setAddonDialogOpen] = useState(false)
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null)
  const [deletingAddonId, setDeletingAddonId] = useState<string | null>(null)

  useEffect(() => {
    loadProducts()
    loadAddons()
  }, [])

  useEffect(() => {
    filterProducts()
  }, [products, searchTerm, typeFilter])

  const productCategories = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((p) => p.category)
            .filter((c): c is string => Boolean(c && c.trim().length > 0))
            .map((c) => c.trim()),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [products],
  )

  async function loadProducts() {
    try {
      setLoading(true)
      const response = await fetch("/api/products?include_inactive=1")
      if (!response.ok) throw new Error("Failed to load products")
      const data = await response.json()
      setProducts(data)
    } catch (error) {
      console.error("Error loading products:", error)
    } finally {
      setLoading(false)
    }
  }

  async function loadAddons() {
    try {
      setAddonsLoading(true)
      const response = await fetch("/api/addons?include_inactive=1")
      if (!response.ok) throw new Error("Failed to load addons")
      const data = await response.json()
      setAddons(data)
    } catch (error) {
      console.error("Error loading addons:", error)
    } finally {
      setAddonsLoading(false)
    }
  }

  function filterProducts() {
    let filtered = products

    if (searchTerm) {
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    }

    if (typeFilter !== "ALL") {
      filtered = filtered.filter((p) => p.type === typeFilter)
    }

    setFilteredProducts(filtered)
  }

  function handleEdit(product: Product) {
    setEditingProduct(product)
    setDialogOpen(true)
  }

  function handleCreate() {
    setEditingProduct(null)
    setDialogOpen(true)
  }

  function handleCreateAddon() {
    setEditingAddon(null)
    setAddonDialogOpen(true)
  }

  function handleEditAddon(addon: Addon) {
    setEditingAddon(addon)
    setAddonDialogOpen(true)
  }

  function handleDialogClose(saved: boolean) {
    setDialogOpen(false)
    setEditingProduct(null)
    if (saved) {
      loadProducts()
    }
  }

  function handleAddonDialogClose(saved: boolean) {
    setAddonDialogOpen(false)
    setEditingAddon(null)
    if (saved) {
      loadAddons()
    }
  }

  async function handleDelete(product: Product) {
    setProductToDelete(product)
    setDeleteDialogOpen(true)
  }

  async function handleToggleActive(product: Product, isActive: boolean) {
    try {
      setUpdatingStatusId(product.id)
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
      })
      if (!response.ok) {
        throw new Error("Failed to update product status")
      }
      await loadProducts()
    } catch (error) {
      console.error("Error toggling product status:", error)
      alert("Erro ao atualizar status do produto. Tente novamente.")
    } finally {
      setUpdatingStatusId(null)
    }
  }

  async function confirmDelete() {
    if (!productToDelete) return

    try {
      setDeleting(true)
      const response = await fetch(`/api/products/${productToDelete.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        let message = "Failed to delete product"
        try {
          const body = await response.json()
          if (body?.error) message = body.error
        } catch {
          // ignore parse errors
        }
        throw new Error(message)
      }

      await loadProducts()
      setDeleteDialogOpen(false)
      setProductToDelete(null)
    } catch (error) {
      console.error("Error deleting product:", error)
      alert((error as Error)?.message || "Erro ao deletar produto. Tente novamente.")
    } finally {
      setDeleting(false)
    }
  }

  async function handleDeleteAddon(id: string) {
    const confirmed = window.confirm("Excluir este adicional?")
    if (!confirmed) return
    try {
      setDeletingAddonId(id)
      const response = await fetch(`/api/addons/${id}`, { method: "DELETE" })
      if (!response.ok) {
        throw new Error("Failed to delete addon")
      }
      await loadAddons()
    } catch (error) {
      console.error("Error deleting addon:", error)
      alert((error as Error)?.message || "Erro ao excluir adicional")
    } finally {
      setDeletingAddonId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Produtos e combos</h1>
          <p className="text-muted-foreground mt-2">Gerenciamento do catálogo de produtos</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo produto
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button variant={typeFilter === "ALL" ? "default" : "outline"} onClick={() => setTypeFilter("ALL")}>
            Todos
          </Button>
          <Button variant={typeFilter === "UNIT" ? "default" : "outline"} onClick={() => setTypeFilter("UNIT")}>
            Produtos
          </Button>
          <Button variant={typeFilter === "COMBO" ? "default" : "outline"} onClick={() => setTypeFilter("COMBO")}>
            Combos
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="border rounded-lg">
          <table className="w-full">
            <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Nome</th>
                    <th className="text-left p-3 font-medium">Tipo</th>
                    <th className="text-left p-3 font-medium">Categoria</th>
                    <th className="text-center p-3 font-medium">Cozinha</th>
                    <th className="text-right p-3 font-medium">Preço</th>
                    <th className="text-center p-3 font-medium">Status</th>
                    <th className="text-center p-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum produto encontrado
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className={`border-b last:border-0 hover:bg-muted/30 ${
                      !product.is_active ? "opacity-70" : ""
                    }`}
                  >
                    <td className="p-3">{product.name}</td>
                    <td className="p-3">{product.type === "UNIT" ? "Produto" : "Combo"}</td>
                    <td className="p-3">{product.category || "—"}</td>
                    <td className="p-3 text-center">
                      {product.requires_kitchen ? (
                        <Badge variant="secondary" className="text-xs">
                          Sim
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Não
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-right">R$ {product.price.toFixed(2)}</td>
                    <td className="p-3 text-center">
                      {product.is_active ? (
                        <Badge variant="secondary" className="text-xs">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs border-destructive text-destructive">
                          Inativo
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(product)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(product, !product.is_active)}
                          disabled={updatingStatusId === product.id}
                          className={!product.is_active ? "text-muted-foreground" : ""}
                        >
                          {product.is_active ? "Desativar" : "Reativar"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(product)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <ProductFormDialog open={dialogOpen} product={editingProduct} onClose={handleDialogClose} />

      {/* Adicionais */}
      <div className="mt-10 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Adicionais</h2>
            <p className="text-muted-foreground text-sm">Gerencie adicionais por categoria</p>
          </div>
          <Button onClick={handleCreateAddon} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Novo adicional
          </Button>
        </div>

        <div className="border rounded-lg">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Nome</th>
                <th className="text-left p-3 font-medium">Categorias</th>
                <th className="text-right p-3 font-medium">Preço</th>
                <th className="text-center p-3 font-medium">Status</th>
                <th className="text-center p-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {addonsLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              ) : addons.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-muted-foreground">
                    Nenhum adicional cadastrado
                  </td>
                </tr>
              ) : (
                addons.map((addon) => (
                  <tr key={addon.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">{addon.name}</td>
                    <td className="p-3">
                      {addon.categories && addon.categories.length > 0
                        ? addon.categories.join(", ")
                        : addon.category}
                    </td>
                    <td className="p-3 text-right">R$ {Number(addon.price).toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <Badge variant={addon.is_active ? "secondary" : "outline"} className="text-xs">
                        {addon.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEditAddon(addon)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAddon(addon.id)}
                          disabled={deletingAddonId === addon.id}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir remove definitivamente o produto{" "}
              <strong>{productToDelete?.name}</strong>. Se ele estiver vinculado a pedidos, a exclusão será bloqueada —
              use “Desativar” para ocultar do catálogo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} variant="destructive">
              {deleting ? "Excluindo..." : "Excluir definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

      <AddonFormDialog
        open={addonDialogOpen}
        addon={editingAddon}
        onClose={handleAddonDialogClose}
        categories={productCategories}
      />
    </div>
  )
}

interface AddonFormDialogProps {
  open: boolean
  addon: Addon | null
  onClose: (saved: boolean) => void
  categories: string[]
}

function AddonFormDialog({ open, addon, onClose, categories }: AddonFormDialogProps) {
  const [name, setName] = useState(addon?.name || "")
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    addon?.categories && addon.categories.length > 0
      ? addon.categories
      : addon?.category
        ? [addon.category]
        : [],
  )
  const [price, setPrice] = useState(addon ? String(addon.price) : "")
  const [isActive, setIsActive] = useState(addon?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [newCategory, setNewCategory] = useState("")

  useEffect(() => {
    setName(addon?.name || "")
    setSelectedCategories(
      addon?.categories && addon.categories.length > 0
        ? addon.categories
        : addon?.category
          ? [addon.category]
          : [],
    )
    setPrice(addon ? String(addon.price) : "")
    setIsActive(addon?.is_active ?? true)
    setNewCategory("")
  }, [addon, open, categories])

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(cat)) {
        return prev.filter((c) => c !== cat)
      }
      return [...prev, cat]
    })
  }

  const addCustomCategory = () => {
    const trimmed = newCategory.trim()
    if (!trimmed) return
    setSelectedCategories((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
    setNewCategory("")
  }

  const handleSave = async () => {
    try {
      if (!name.trim()) {
        alert("Nome é obrigatório")
        return
      }
      if (!selectedCategories.length) {
        alert("Selecione ou adicione ao menos uma categoria")
        return
      }
      setSaving(true)
      const payload = {
        name: name.trim(),
        category: selectedCategories[0], // legado
        categories: selectedCategories,
        price: Number(price) || 0,
        is_active: isActive,
      }
      const response = await fetch(addon ? `/api/addons/${addon.id}` : "/api/addons", {
        method: addon ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        let msg = "Falha ao salvar adicional"
        try {
          const body = await response.json()
          if (body?.error) msg = body.error
        } catch {
          // ignore
        }
        throw new Error(msg)
      }
      onClose(true)
    } catch (error) {
      console.error("Error saving addon:", error)
      alert((error as Error)?.message || "Erro ao salvar adicional")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{addon ? "Editar adicional" : "Novo adicional"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="addon-name">Nome</Label>
            <Input
              id="addon-name"
              placeholder="Ex: Queijo extra"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Categorias</Label>
            {categories.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {categories.map((cat) => (
                  <label key={cat} className="flex items-center gap-2 rounded border p-2">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat)}
                      onChange={() => toggleCategory(cat)}
                      className="h-4 w-4"
                    />
                    <span>{cat}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                id="addon-category"
                placeholder="Adicionar nova categoria"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
              <Button type="button" onClick={addCustomCategory}>
                Adicionar
              </Button>
            </div>
            {selectedCategories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedCategories.map((cat) => (
                  <Badge key={cat} variant="secondary" className="flex items-center gap-1">
                    {cat}
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="addon-price">Preço</Label>
            <Input
              id="addon-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="addon-active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="addon-active">Ativo</Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onClose(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
