"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { Order } from "@/src/domain/types"
import { createClient } from "@/lib/supabase/client"

interface NotificationSettings {
  enabled: boolean
  volume: number
  lastNotifiedOrderIds: string[]
  lastCheckTimestamp: string
}

const STORAGE_KEY = "order-notifications-settings"

export function useOrderNotifications(restaurantId: string) {
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    volume: 0.7,
    lastNotifiedOrderIds: [],
    lastCheckTimestamp: new Date().toISOString(),
  })
  const [newOrdersCount, setNewOrdersCount] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastCheckRef = useRef<Date>(new Date(settings.lastCheckTimestamp))

  // Carregar configurações do localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setSettings(parsed)
        if (parsed.lastCheckTimestamp) {
          lastCheckRef.current = new Date(parsed.lastCheckTimestamp)
        }
      } catch (e) {
        console.error("Erro ao carregar configurações de notificação:", e)
      }
    }
  }, [])

  // Salvar configurações no localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  // Inicializar áudio
  useEffect(() => {
    const audio = new Audio("https://hebbkx1anhila5yf.public.blob.vercel-storage.com/sound-effect-old-phone-191761-eyLH27joqtVY4aT3BiEFgEij5zOzb4.mp3")
    audio.volume = settings.volume
    audioRef.current = audio

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
    }
  }, [settings.volume])

  // Função para tocar o som
  const playNotificationSound = useCallback(() => {
    if (!settings.enabled || !audioRef.current) return

    try {
      const audio = audioRef.current
      audio.volume = settings.volume
      audio.currentTime = 0 // Começar do início

      const playPromise = audio.play()

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Parar após 4 segundos
            setTimeout(() => {
              audio.pause()
              audio.currentTime = 0
            }, 4000)
          })
          .catch((error) => {
            console.error("Erro ao tocar som de notificação:", error)
          })
      }
    } catch (error) {
      console.error("Erro ao tocar som de notificação:", error)
    }
  }, [settings.enabled, settings.volume])

  // Checar novos pedidos
  const checkNewOrders = useCallback(async () => {
    if (!restaurantId || !settings.enabled) return

    try {
      const response = await fetch(`/api/orders?status=NOVO&channel=AGENTE&since=${lastCheckRef.current.toISOString()}`)
      if (!response.ok) return

      const orders: Order[] = await response.json()

      // Filtrar apenas pedidos realmente novos que ainda não foram notificados
      const newOrders = orders.filter((order) => !settings.lastNotifiedOrderIds.includes(order.id))

      if (newOrders.length > 0) {
        // Tocar som
        playNotificationSound()

        // Atualizar contador
        setNewOrdersCount((prev) => prev + newOrders.length)

        const now = new Date()
        lastCheckRef.current = now

        setSettings((prev) => ({
          ...prev,
          lastNotifiedOrderIds: [...prev.lastNotifiedOrderIds, ...newOrders.map((o) => o.id)].slice(-50),
          lastCheckTimestamp: now.toISOString(),
        }))

        // Limpar contador após 5 segundos
        setTimeout(() => {
          setNewOrdersCount(0)
        }, 5000)
      } else {
        const now = new Date()
        lastCheckRef.current = now
        setSettings((prev) => ({
          ...prev,
          lastCheckTimestamp: now.toISOString(),
        }))
      }
    } catch (error) {
      console.error("Erro ao checar novos pedidos:", error)
    }
  }, [restaurantId, settings.enabled, settings.lastNotifiedOrderIds, playNotificationSound])

  // Polling de novos pedidos (apenas fallback; realtime cuida do principal)
  useEffect(() => {
    if (!settings.enabled) return

    checkNewOrders()

    return undefined
  }, [settings.enabled, checkNewOrders])

  // Realtime Supabase para novos pedidos
  useEffect(() => {
    if (!restaurantId || !settings.enabled) return

    const supabase = createClient()

    const channel = supabase
      .channel(`orders-notify-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const newOrder = payload.new as Order | undefined
          if (newOrder && newOrder.status === "NOVO") {
            // Evita duplicar aviso
            setSettings((prev) => {
              if (prev.lastNotifiedOrderIds.includes(newOrder.id)) return prev
              playNotificationSound()
              setNewOrdersCount((n) => n + 1)
              const now = new Date()
              lastCheckRef.current = now
              setTimeout(() => setNewOrdersCount(0), 5000)
              return {
                ...prev,
                lastNotifiedOrderIds: [...prev.lastNotifiedOrderIds, newOrder.id].slice(-50),
                lastCheckTimestamp: now.toISOString(),
              }
            })
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId, settings.enabled, playNotificationSound])

  // Funções de controle
  const toggleEnabled = useCallback(() => {
    setSettings((prev) => ({ ...prev, enabled: !prev.enabled }))
  }, [])

  const setVolume = useCallback((volume: number) => {
    setSettings((prev) => ({ ...prev, volume: Math.max(0, Math.min(1, volume)) }))
  }, [])

  const testSound = useCallback(() => {
    playNotificationSound()
  }, [playNotificationSound])

  const clearNotifications = useCallback(() => {
    setNewOrdersCount(0)
  }, [])

  return {
    enabled: settings.enabled,
    volume: settings.volume,
    newOrdersCount,
    toggleEnabled,
    setVolume,
    testSound,
    clearNotifications,
  }
}
