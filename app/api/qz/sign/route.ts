import { createSign } from "crypto"
import { NextResponse } from "next/server"

const ALLOWED_ORIGINS = new Set(["https://lanchonetev2.vercel.app", "http://localhost:3000"])

const withCors = (response: NextResponse, origin: string | null) => {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin)
  }
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  response.headers.set("Access-Control-Allow-Headers", "Content-Type")
  return response
}

export const POST = async (request: Request) => {
  const origin = request.headers.get("origin")
  const rawKey = process.env.QZ_PRIVATE_KEY_PEM || ""
  if (!rawKey) {
    return withCors(NextResponse.json({ error: "Missing QZ_PRIVATE_KEY_PEM" }, { status: 500 }), origin)
  }

  let body: { toSign?: string } = {}
  try {
    body = await request.json()
  } catch (_err) {
    body = {}
  }

  if (!body.toSign) {
    return withCors(NextResponse.json({ error: "Missing toSign" }, { status: 400 }), origin)
  }

  const privateKey = rawKey.replace(/\\n/g, "\n")
  const signer = createSign("RSA-SHA512")
  signer.update(body.toSign, "utf8")
  signer.end()
  const signature = signer.sign(privateKey, "base64")

  return withCors(NextResponse.json({ signature }), origin)
}

export const OPTIONS = async (request: Request) => {
  const origin = request.headers.get("origin")
  return withCors(new NextResponse(null, { status: 204 }), origin)
}
