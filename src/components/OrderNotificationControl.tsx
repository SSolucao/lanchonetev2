"use client"

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Bell, BellOff, Volume2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface OrderNotificationControlProps {
  enabled: boolean
  volume: number
  newOrdersCount: number
  onToggle: () => void
  onVolumeChange: (volume: number) => void
  onTest: () => void
}

export function OrderNotificationControl({
  enabled,
  volume,
  newOrdersCount,
  onToggle,
  onVolumeChange,
  onTest,
}: OrderNotificationControlProps) {
  return (
    <div className="flex items-center gap-2">
      {newOrdersCount > 0 && (
        <Badge variant="destructive" className="animate-pulse">
          {newOrdersCount} novo{newOrdersCount > 1 ? "s" : ""}
        </Badge>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="relative bg-transparent">
            {enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            {newOrdersCount > 0 && (
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-ping" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="end">
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Notificações de Pedidos</h4>
              <p className="text-sm text-muted-foreground">Alerta sonoro quando novos pedidos chegarem</p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Alertas</span>
              <Button variant={enabled ? "default" : "outline"} size="sm" onClick={onToggle}>
                {enabled ? "Ligado" : "Desligado"}
              </Button>
            </div>

            {enabled && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Volume2 className="h-4 w-4" />
                      Volume
                    </span>
                    <span className="text-sm text-muted-foreground">{Math.round(volume * 100)}%</span>
                  </div>
                  <Slider
                    value={[volume * 100]}
                    onValueChange={(value) => onVolumeChange(value[0] / 100)}
                    max={100}
                    step={10}
                    className="w-full"
                  />
                </div>

                <Button variant="outline" size="sm" onClick={onTest} className="w-full bg-transparent">
                  Testar Som
                </Button>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
