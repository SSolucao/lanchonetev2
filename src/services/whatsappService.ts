import { buildOrderPdfBuffer } from "@/src/lib/print/orderPdf"

const UAZ_API_URL = process.env.UAZAPI_URL || "https://supersolucao.uazapi.com/send/text"
const UAZ_API_MENU_URL = process.env.UAZAPI_MENU_URL || UAZ_API_URL
const UAZ_API_SEND_DOCUMENT_URL = process.env.UAZAPI_SEND_DOCUMENT_URL
const UAZ_API_TOKEN = process.env.UAZAPI_TOKEN

type SendTextParams = {
  number: string
  text: string
}

/**
 * Send a WhatsApp text via UAZAPI (não oficial).
 * Best-effort: falhas não quebram o fluxo chamador.
 */
export async function sendWhatsAppText({ number, text }: SendTextParams): Promise<void> {
  if (!UAZ_API_TOKEN) {
    console.warn("[whatsapp] Missing UAZAPI_TOKEN; skipping message")
    return
  }

  try {
    const res = await fetch(UAZ_API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        token: UAZ_API_TOKEN,
      },
      body: JSON.stringify({ number, text }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.error("[whatsapp] Failed to send message:", res.status, body)
    }
  } catch (err) {
    console.error("[whatsapp] Error calling UAZAPI:", err)
  }
}

type SendMenuParams = {
  number: string
  text: string
  choices: string[]
}

/**
 * Send a WhatsApp menu (buttons) via UAZAPI.
 */
export async function sendWhatsAppMenu({ number, text, choices }: SendMenuParams): Promise<void> {
  if (!UAZ_API_TOKEN) {
    console.warn("[whatsapp] Missing UAZAPI_TOKEN; skipping menu message")
    return
  }

  try {
    const res = await fetch(UAZ_API_MENU_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        token: UAZ_API_TOKEN,
      },
      body: JSON.stringify({ number, type: "button", text, choices }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.error("[whatsapp] Failed to send menu:", res.status, body)
    }
  } catch (err) {
    console.error("[whatsapp] Error calling UAZAPI menu:", err)
  }
}

type SendDocumentParams = {
  number: string
  base64: string
  docName: string
  text?: string
}

/**
 * Send a WhatsApp document via UAZAPI using base64 payload.
 */
export async function sendWhatsAppDocument({ number, base64, docName, text }: SendDocumentParams): Promise<void> {
  if (!UAZ_API_TOKEN || !UAZ_API_SEND_DOCUMENT_URL) {
    console.warn("[whatsapp] Missing UAZAPI_TOKEN or UAZAPI_SEND_DOCUMENT_URL; skipping document")
    return
  }

  try {
    const res = await fetch(UAZ_API_SEND_DOCUMENT_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        token: UAZ_API_TOKEN,
      },
      body: JSON.stringify({
        number,
        type: "document",
        file: base64,
        docName,
        text,
        mimetype: "application/pdf",
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.error("[whatsapp] Failed to send document:", res.status, body)
    }
  } catch (err) {
    console.error("[whatsapp] Error calling UAZAPI document:", err)
  }
}

type SendOrderPdfParams = {
  orderId: string
  number: string
  text?: string
  delayMs?: number
}

export async function sendOrderPdfToWhatsApp({
  orderId,
  number,
  text = "Segue o cupom do seu pedido.",
  delayMs,
}: SendOrderPdfParams): Promise<void> {
  if (delayMs && delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  const buffer = await buildOrderPdfBuffer(orderId)
  const base64 = buffer.toString("base64")
  const docName = `pedido-${orderId}.pdf`
  await sendWhatsAppDocument({ number, base64, docName, text })
}
