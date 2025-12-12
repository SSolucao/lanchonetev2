const UAZ_API_URL = process.env.UAZAPI_URL || "https://supersolucao.uazapi.com/send/text"
const UAZ_API_MENU_URL = process.env.UAZAPI_MENU_URL || UAZ_API_URL
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
