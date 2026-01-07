// Cliente utilitário para QZ Tray (impressão local via navegador)

interface PrinterConfig {
  selectedPrinter: string
  autoPrint: boolean
  vias: number
  encoding: string
  codePage: number
}

const STORAGE_KEY = "printerConfig"
const MODEL_STORAGE_KEY = "printerModelConfig"

interface PrinterModelConfig {
  selectedCategories: string[]
  modalities: {
    balcao: boolean
    retirada: boolean
    entrega: boolean
    comanda: boolean
  }
  showHeader: boolean
  showCustomer: boolean
  showPayment: boolean
  showObservations: boolean
  showValues: boolean
  width: "32" | "48"
  footerText: string
}

export const getPrinterConfig = (): PrinterConfig => {
  if (typeof window === "undefined") {
    return { selectedPrinter: "", autoPrint: false, vias: 1, encoding: "CP860", codePage: 3 }
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return { selectedPrinter: "", autoPrint: false, vias: 1, encoding: "CP860", codePage: 3 }
    const parsed = JSON.parse(saved)
    return {
      selectedPrinter: parsed.selectedPrinter || "",
      autoPrint: Boolean(parsed.autoPrint),
      vias: Math.max(1, Number(parsed.vias) || 1),
      encoding: typeof parsed.encoding === "string" && parsed.encoding ? parsed.encoding : "CP860",
      codePage: Number.isFinite(Number(parsed.codePage)) ? Number(parsed.codePage) : 3,
    }
  } catch (_err) {
    return { selectedPrinter: "", autoPrint: false, vias: 1, encoding: "CP860", codePage: 3 }
  }
}

export const getPrinterModelConfig = (): PrinterModelConfig => {
  if (typeof window === "undefined") {
    return {
      selectedCategories: [],
      modalities: { balcao: true, retirada: true, entrega: true, comanda: true },
      showHeader: true,
      showCustomer: true,
      showPayment: true,
      showObservations: true,
      showValues: true,
      width: "32",
      footerText: "",
    }
  }
  try {
    const saved = localStorage.getItem(MODEL_STORAGE_KEY)
    if (!saved) {
      return {
        selectedCategories: [],
        modalities: { balcao: true, retirada: true, entrega: true, comanda: true },
        showHeader: true,
        showCustomer: true,
        showPayment: true,
        showObservations: true,
        showValues: true,
        width: "32",
        footerText: "",
      }
    }
    const parsed = JSON.parse(saved)
    return {
      selectedCategories: Array.isArray(parsed.selectedCategories) ? parsed.selectedCategories : [],
      modalities: {
        balcao: parsed.modalities?.balcao !== false,
        retirada: parsed.modalities?.retirada !== false,
        entrega: parsed.modalities?.entrega !== false,
        comanda: parsed.modalities?.comanda !== false,
      },
      showHeader: parsed.showHeader !== false,
      showCustomer: parsed.showCustomer !== false,
      showPayment: parsed.showPayment !== false,
      showObservations: parsed.showObservations !== false,
      showValues: parsed.showValues !== false,
      width: parsed.width === "48" ? "48" : "32",
      footerText: typeof parsed.footerText === "string" ? parsed.footerText : "",
    }
  } catch (_err) {
    return {
      selectedCategories: [],
      modalities: { balcao: true, retirada: true, entrega: true, comanda: true },
      showHeader: true,
      showCustomer: true,
      showPayment: true,
      showObservations: true,
      showValues: true,
      width: "32",
      footerText: "",
    }
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

const wrapLine = (text: string, width: number): string[] => {
  if (!text) return [""]
  if (text.length <= width) return [text]
  const words = text.split(" ")
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= width) {
      current = next
      continue
    }

    if (current) lines.push(current)

    if (word.length > width) {
      for (let i = 0; i < word.length; i += width) {
        lines.push(word.slice(i, i + width))
      }
      current = ""
    } else {
      current = word
    }
  }

  if (current) lines.push(current)
  return lines
}

const wrapLines = (lines: string[], width: number): string[] => {
  const out: string[] = []
  lines.forEach((line) => {
    wrapLine(line, width).forEach((wrapped) => out.push(wrapped))
  })
  return out
}

const getPrintColumns = () => {
  const model = getPrinterModelConfig()
  return model.width === "48" ? 48 : 32
}

// Normaliza linhas para CRLF e ajusta largura da impressão (58mm)
export const printCupom = async (printer: string, lines: string[], vias: number = 1) => {
  const qz = await ensureQzConnection()
  const { encoding, codePage } = getPrinterConfig()
  const safeCodePage = Number.isFinite(codePage) ? Math.max(0, Math.min(255, codePage)) : 3
  const cfg = qz.configs.create(printer, { encoding })
  const copies = Math.max(1, vias)

  // Converte \n em \r\n, mas não duplica se já existir \r\n
  const normalize = (text: string) => text.replace(/\r?\n/g, "\r\n")

  // Monta payload ESC/POS
  const base: string[] = []
  base.push("\x1B\x40") // init
  base.push(`\x1B\x74${String.fromCharCode(safeCodePage)}`) // seleciona tabela de caracteres
  base.push("\x1B\x61\x00") // alinhar à esquerda
  const wrapped = wrapLines(lines, getPrintColumns())
  wrapped.forEach((ln) => base.push(`${normalize(ln)}\r\n`)) // garante CRLF ao final de cada linha
  // feed final para garantir saída do papel (sem corte)
  base.push("\r\n\r\n\r\n")
  base.push("\x1B\x64\x04") // feed 4 linhas

  for (let i = 0; i < copies; i += 1) {
    await qz.print(cfg, base)
  }
}

// Constrói um payload ESC/POS simples com itens, adicionais e observações
export const buildEscposFromOrder = (order: any): string[] => {
  const lines: string[] = []
  const model = getPrinterModelConfig()
  const col = model.width === "48" ? 48 : 32
  const sep = "-".repeat(col)
  const priceLabel = (value: number) => `R$ ${Number(value || 0).toFixed(2)}`

  const tipoPedidoLabel = () => {
    switch (order?.tipo_pedido) {
      case "BALCAO":
        return "BALCÃO"
      case "RETIRADA":
        return "RETIRADA"
      case "ENTREGA":
        return "ENTREGA"
      case "COMANDA":
        return order?.comanda?.numero
          ? `COMANDA #${String(order.comanda.numero).padStart(3, "0")}`
          : "COMANDA"
      default:
        if (order?.channel === "BALCAO") return "BALCÃO"
        if (order?.delivery_mode === "RETIRA") return "RETIRADA"
        return "ENTREGA"
    }
  }

  if (model.showHeader) {
    lines.push(tipoPedidoLabel())
    lines.push(sep)
    if (order?.created_at) lines.push(new Date(order.created_at).toLocaleString("pt-BR"))
    if (order?.restaurant?.name) lines.push(order.restaurant.name)
    lines.push(sep)
  }

  lines.push(`Pedido ${order?.order_number || ""}`)
  lines.push("Itens")

  order?.items?.forEach((it: any) => {
    const line = `${it.quantity}x ${it.product_name}`
    if (model.showValues) {
      const price = priceLabel(Number(it.total_price || 0))
      const spaces = Math.max(1, col - line.length - price.length)
      lines.push(line + " ".repeat(spaces) + price)
    } else {
      lines.push(line)
    }
    if (it.addons && it.addons.length > 0) {
      it.addons.forEach((ad: any) => {
        lines.push(`  + ${ad.quantity}x ${ad.name}`)
      })
    }
    if (model.showObservations && it.notes) {
      lines.push(`  Obs: ${it.notes}`)
    }
    lines.push("-------")
  })

  if (model.showCustomer && order?.customer) {
    lines.push("Cliente")
    if (order.customer.name) lines.push(`Nome: ${order.customer.name}`)
    if (order.customer.phone) lines.push(`Telefone: ${order.customer.phone}`)
    const shouldShowAddress =
      order?.tipo_pedido === "ENTREGA" ||
      order?.tipo_pedido === "RETIRADA" ||
      order?.channel === "DELIVERY" ||
      order?.delivery_mode === "ENTREGA"
    if (shouldShowAddress) {
      if (order.customer.neighborhood) lines.push(`Bairro: ${order.customer.neighborhood}`)
      if (order.customer.street) {
        const addressLine = `${order.customer.street}${order.customer.number ? `, ${order.customer.number}` : ""}`
        lines.push(addressLine)
      }
      if (order.customer.city) lines.push(order.customer.city)
      if (order.customer.cep) lines.push(`CEP: ${order.customer.cep}`)
    }
    if (order.customer.notes) lines.push(order.customer.notes)
    lines.push(sep)
  }

  if (model.showPayment) {
    const paymentName =
      typeof order?.payment_method === "string" ? order.payment_method : order?.payment_method?.name
    if (paymentName) {
      lines.push("Pagamento")
      lines.push(`Forma de Pagamento: ${paymentName}`)
      lines.push(sep)
    }
  }

  if (model.showValues) {
    const subtotal = Number(order?.subtotal || 0)
    const deliveryFee = Number(order?.delivery_fee || 0)
    const total = Number(order?.total || 0)
    lines.push(`Subtotal: ${priceLabel(subtotal)}`)
    if (deliveryFee > 0) {
      lines.push(`Taxa entrega: ${priceLabel(deliveryFee)}`)
    }
    lines.push(`Total: ${priceLabel(total)}`)
    lines.push(sep)
  }

  if (model.showObservations && order?.notes) {
    lines.push("Observações")
    lines.push(order.notes)
    lines.push(sep)
  }

  if (model.footerText.trim()) lines.push(model.footerText.trim())

  return lines
}
