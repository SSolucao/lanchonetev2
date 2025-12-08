"use client"

import { useState, useCallback } from "react"
import type { Product, Customer, TipoPedido } from "@/src/domain/types"

export interface DraftOrderItem {
  product: Product
  quantity: number
  notes: string
}

export interface DraftOrder {
  items: DraftOrderItem[]
  tipoPedido: TipoPedido
  customer: Customer | null
  deliveryFee: number
  paymentMethodId: string | null
  notes: string
}

const initialDraftOrder: DraftOrder = {
  items: [],
  tipoPedido: "RETIRADA",
  customer: null,
  deliveryFee: 0,
  paymentMethodId: null,
  notes: "",
}

export function usePdvOrder() {
  const [draft, setDraft] = useState<DraftOrder>(initialDraftOrder)

  const addItem = useCallback((product: Product) => {
    setDraft((prev) => {
      const existingIndex = prev.items.findIndex((item) => item.product.id === product.id)

      if (existingIndex >= 0) {
        const newItems = [...prev.items]
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: newItems[existingIndex].quantity + 1,
        }
        return { ...prev, items: newItems }
      }

      return {
        ...prev,
        items: [...prev.items, { product, quantity: 1, notes: "" }],
      }
    })
  }, [])

  const removeItem = useCallback((productId: string) => {
    setDraft((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.product.id !== productId),
    }))
  }, [])

  const updateItemQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) return

    setDraft((prev) => {
      const newItems = prev.items.map((item) => (item.product.id === productId ? { ...item, quantity } : item))
      return { ...prev, items: newItems }
    })
  }, [])

  const updateItemNotes = useCallback((productId: string, notes: string) => {
    setDraft((prev) => {
      const newItems = prev.items.map((item) => (item.product.id === productId ? { ...item, notes } : item))
      return { ...prev, items: newItems }
    })
  }, [])

  const setTipoPedido = useCallback((tipoPedido: TipoPedido) => {
    setDraft((prev) => {
      // Reset delivery fee for non-delivery orders
      if (tipoPedido !== "ENTREGA") {
        return {
          ...prev,
          tipoPedido,
          deliveryFee: 0,
          customer: tipoPedido === "BALCAO" ? null : prev.customer,
        }
      }
      return { ...prev, tipoPedido }
    })
  }, [])

  const setCustomer = useCallback((customer: Customer | null) => {
    setDraft((prev) => ({ ...prev, customer }))
  }, [])

  const setDeliveryFee = useCallback((fee: number) => {
    setDraft((prev) => ({ ...prev, deliveryFee: Math.max(0, fee) }))
  }, [])

  const setPaymentMethod = useCallback((paymentMethodId: string | null) => {
    setDraft((prev) => ({ ...prev, paymentMethodId }))
  }, [])

  const setNotes = useCallback((notes: string) => {
    setDraft((prev) => ({ ...prev, notes }))
  }, [])

  const clearDraft = useCallback(() => {
    setDraft(initialDraftOrder)
  }, [])

  const subtotal = draft.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

  const total = subtotal + draft.deliveryFee

  return {
    draft,
    addItem,
    removeItem,
    updateItemQuantity,
    updateItemNotes,
    setTipoPedido,
    setCustomer,
    setDeliveryFee,
    setPaymentMethod,
    setNotes,
    clearDraft,
    subtotal,
    total,
  }
}
