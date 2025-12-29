// Cliente utilitário para QZ Tray (impressão local via navegador)

interface PrinterConfig {
  selectedPrinter: string
  autoPrint: boolean
  vias: number
}

const STORAGE_KEY = "printerConfig"

export const getPrinterConfig = (): PrinterConfig => {
  if (typeof window === "undefined") return { selectedPrinter: "", autoPrint: false, vias: 1 }
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return { selectedPrinter: "", autoPrint: false, vias: 1 }
    const parsed = JSON.parse(saved)
    return {
      selectedPrinter: parsed.selectedPrinter || "",
      autoPrint: Boolean(parsed.autoPrint),
      vias: Math.max(1, Number(parsed.vias) || 1),
    }
  } catch (_err) {
    return { selectedPrinter: "", autoPrint: false, vias: 1 }
  }
}

export const ensureQzConnection = async () => {
  const qz = (typeof window !== "undefined" && (window as any).qz) || null
  if (!qz) throw new Error("QZ Tray não carregado. Verifique a instalação.")
  if (!qz.websocket.isActive()) {
    await qz.websocket.connect()
  }
  return qz
}

export const listPrinters = async (): Promise<string[]> => {
  const qz = await ensureQzConnection()
  const list = await qz.printers.find()
  return list || []
}

export const printRaw = async (printer: string, data: string[], vias: number = 1) => {
  const qz = await ensureQzConnection()
  const cfg = qz.configs.create(printer)
  const copies = Math.max(1, vias)
  for (let i = 0; i < copies; i += 1) {
    await qz.print(cfg, data)
  }
}

// Constrói um payload ESC/POS simples com itens, adicionais e observações
export const buildEscposFromOrder = (order: any): string[] => {
  const lines: string[] = []
  lines.push("\x1B\x40") // init
  lines.push(`PEDIDO #${order?.order_number || ""}\n`)
  if (order?.tipo_pedido) lines.push(`${order.tipo_pedido}\n`)
  lines.push("--------------------------\n")

  order?.items?.forEach((it: any) => {
    lines.push(`${it.quantity}x ${it.product_name}\n`)
    if (it.addons && it.addons.length > 0) {
      it.addons.forEach((ad: any) => {
        lines.push(`  + ${ad.quantity}x ${ad.name}\n`)
      })
    }
    if (it.notes) {
      lines.push(`  Obs: ${it.notes}\n`)
    }
    lines.push("\n")
  })

  lines.push("\x1B\x64\x03") // feed 3
  lines.push("\x1D\x56\x00") // cut
  return lines
}
