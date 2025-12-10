import { NextResponse } from "next/server"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { getOrderForPrint } from "@/src/services/ordersService"

function mmToPt(mm: number) {
  return (mm / 25.4) * 72
}

async function buildPdf(orderId: string) {
  const order = await getOrderForPrint(orderId)
  if (!order) {
    throw new Error("ORDER_NOT_FOUND")
  }

  const doc = await PDFDocument.create()
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica)

  const pageWidth = mmToPt(100)
  const pageHeight = mmToPt(150)
  const margin = mmToPt(5)

  const createdAt = new Date(order.created_at)
  const dateStr = createdAt.toLocaleDateString("pt-BR")
  const timeStr = createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  const printStamp = new Date().toLocaleString("pt-BR")
  const tipoLabel = (() => {
    switch (order.tipo_pedido) {
      case "BALCAO":
        return "BALCÃO"
      case "RETIRADA":
        return "RETIRADA"
      case "ENTREGA":
        return "ENTREGA"
      case "COMANDA":
        return order.comanda ? `COMANDA #${String(order.comanda.numero).padStart(3, "0")}` : "COMANDA"
      default:
        return order.channel || "PEDIDO"
    }
  })()

  const drawText = (
    page: any,
    text: string,
    x: number,
    y: number,
    size = 12,
    bold = false,
    options: { align?: "left" | "center" | "right" } = {},
  ) => {
    const font = bold ? fontBold : fontRegular
    const textWidth = font.widthOfTextAtSize(text, size)
    let drawX = x
    if (options.align === "center") drawX = x - textWidth / 2
    if (options.align === "right") drawX = x - textWidth
    page.drawText(text, { x: drawX, y, size, font, color: rgb(0, 0, 0) })
  }

  const addKitchenPage = () => {
    const page = doc.addPage([pageWidth, pageHeight])
    let y = pageHeight - margin

    drawText(page, order.restaurant?.name || "Restaurante", pageWidth / 2, y, 16, true, { align: "center" })
    y -= 18
    drawText(page, "Comanda de Cozinha", pageWidth / 2, y, 10, true, { align: "center" })
    y -= 26

    drawText(page, `#${order.order_number}`, margin, y, 28, true)
    drawText(page, `${dateStr} ${timeStr}`, margin, y - 16, 10, false)
    drawText(page, tipoLabel, pageWidth - margin, y, 10, true, { align: "right" })
    y -= 32

    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
    y -= 12

    if (
      (order.tipo_pedido === "ENTREGA" || order.tipo_pedido === "RETIRADA" || order.channel === "DELIVERY") &&
      order.customer
    ) {
      drawText(page, "Cliente", margin, y, 11, true)
      y -= 14
      drawText(page, order.customer.name || "", margin, y, 11)
      y -= 14
      if (order.customer.neighborhood) {
        drawText(page, `Bairro: ${order.customer.neighborhood}`, margin, y, 11)
        y -= 14
      }
      if (order.customer.street) {
        const addr = `${order.customer.street}${order.customer.number ? `, ${order.customer.number}` : ""}`
        drawText(page, addr, margin, y, 11)
        y -= 14
      }
      y -= 4
    }

    drawText(page, "Itens do pedido", margin, y, 11, true)
    y -= 14
    order.items?.forEach((item) => {
      drawText(page, `${item.quantity}x ${item.product_name}`, margin, y, 12, true)
      y -= 13
      if (item.notes) {
        drawText(page, `Obs: ${item.notes}`, margin, y, 10, false)
        y -= 12
      }
      y -= 6
    })

    if (order.notes) {
      y -= 4
      drawText(page, "Observações do pedido", margin, y, 11, true)
      y -= 13
      drawText(page, order.notes, margin, y, 10, false)
      y -= 12
    }

    y -= 12
    drawText(page, `Impresso em ${printStamp}`, pageWidth / 2, y, 9, false, { align: "center" })
  }

  const addCustomerPage = () => {
    const page = doc.addPage([pageWidth, pageHeight])
    let y = pageHeight - margin

    drawText(page, order.restaurant?.name || "Restaurante", pageWidth / 2, y, 16, true, { align: "center" })
    y -= 14
    if (order.restaurant?.address) {
      drawText(page, order.restaurant.address, pageWidth / 2, y, 10, false, { align: "center" })
      y -= 14
    } else {
      y -= 8
    }
    drawText(page, "Cupom do Cliente", pageWidth / 2, y, 10, true, { align: "center" })
    y -= 18

    drawText(page, `Pedido: #${order.order_number}`, margin, y, 10, true)
    y -= 12
    drawText(page, `Data: ${dateStr} ${timeStr}`, margin, y, 10, false)
    y -= 12
    drawText(page, `Tipo: ${tipoLabel}`, margin, y, 10, false)
    y -= 18

    if (order.customer) {
      drawText(page, "Cliente", margin, y, 11, true)
      y -= 13
      drawText(page, order.customer.name || "", margin, y, 10, false)
      y -= 12
      if (order.customer.phone) {
        drawText(page, `Tel: ${order.customer.phone}`, margin, y, 10, false)
        y -= 12
      }
      const addrParts = [
        order.customer.street ? `${order.customer.street}${order.customer.number ? `, ${order.customer.number}` : ""}` : "",
        order.customer.neighborhood || "",
        order.customer.city || "",
        order.customer.cep ? `CEP: ${order.customer.cep}` : "",
      ].filter(Boolean)
      if (addrParts.length > 0) {
        drawText(page, addrParts.join(" · "), margin, y, 10, false)
        y -= 14
      }
      y -= 6
    }

    drawText(page, "Itens", margin, y, 11, true)
    y -= 12
    order.items?.forEach((item) => {
      const line = `${item.quantity}x ${item.product_name}`
      const price = `R$ ${item.total_price.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      drawText(page, line, margin, y, 10, false)
      drawText(page, price, pageWidth - margin, y, 10, false, { align: "right" })
      y -= 12
      if (item.notes) {
        drawText(page, `Obs: ${item.notes}`, margin + 8, y, 9, false)
        y -= 11
      }
      y -= 4
    })

    y -= 4
    drawText(page, "Resumo", margin, y, 10, true)
    y -= 12
    drawText(
      page,
      `Subtotal: R$ ${order.subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      margin,
      y,
      10,
      false,
    )
    y -= 12
    if (order.delivery_fee > 0) {
      drawText(
        page,
        `Taxa de entrega: R$ ${order.delivery_fee.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        margin,
        y,
        10,
        false,
      )
      y -= 12
    }
    drawText(
      page,
      `TOTAL: R$ ${order.total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      margin,
      y,
      12,
      true,
    )
    y -= 14
    drawText(page, `Pagamento: ${order.payment_method?.name || "Não informado"}`, margin, y, 10, false)
    y -= 14

    if (order.notes) {
      drawText(page, "Observações", margin, y, 10, true)
      y -= 12
      drawText(page, order.notes, margin, y, 10, false)
      y -= 14
    }

    y -= 8
    drawText(page, `Impresso em ${printStamp}`, pageWidth / 2, y, 9, false, { align: "center" })
  }

  addKitchenPage()
  addCustomerPage()

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params
    const buffer = await buildPdf(orderId)
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="pedido-${orderId}.pdf"`,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }
    console.error("[v0] Error generating print PDF:", error)
    return NextResponse.json({ error: "Falha ao gerar PDF" }, { status: 500 })
  }
}
