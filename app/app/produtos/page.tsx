"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Pencil, Trash2 } from "lucide-react"
import type { Product } from "@/src/domain/types"
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

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    filterProducts()
  }, [products, searchTerm, typeFilter])

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

  function handleDialogClose(saved: boolean) {
    setDialogOpen(false)
    setEditingProduct(null)
    if (saved) {
      loadProducts()
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
                    <th className="text-right p-3 font-medium">Preço</th>
                    <th className="text-center p-3 font-medium">Status</th>
                    <th className="text-center p-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
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
    </div>
  )
}
