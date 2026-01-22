import { createSign } from "crypto"
import { NextResponse } from "next/server"

const ALLOWED_ORIGIN = "https://lanchonetev2.vercel.app"

const withCors = (response: NextResponse) => {
  response.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  response.headers.set("Access-Control-Allow-Headers", "Content-Type")
  return response
}

export const POST = async (request: Request) => {
  const rawKey = process.env.QZ_PRIVATE_KEY_PEM || ""
  if (!rawKey) {
    return withCors(NextResponse.json({ error: "Missing QZ_PRIVATE_KEY_PEM" }, { status: 500 }))
  }

  let body: { toSign?: string } = {}
  try {
    body = await request.json()
  } catch (_err) {
    body = {}
  }

  if (!body.toSign) {
    return withCors(NextResponse.json({ error: "Missing toSign" }, { status: 400 }))
  }

  const privateKey = rawKey.replace(/\\n/g, "\n")
  const signer = createSign("RSA-SHA512")
  signer.update(body.toSign, "utf8")
  signer.end()
  const signature = signer.sign(privateKey, "base64")

  return withCors(NextResponse.json({ signature }))
}

export const OPTIONS = async () => {
  return withCors(new NextResponse(null, { status: 204 }))
}
