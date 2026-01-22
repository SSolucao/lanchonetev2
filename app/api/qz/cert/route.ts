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

export const GET = async (request: Request) => {
  const origin = request.headers.get("origin")
  const rawCert = process.env.QZ_CERT_PEM || ""
  if (!rawCert) {
    return withCors(NextResponse.json({ error: "Missing QZ_CERT_PEM" }, { status: 500 }), origin)
  }

  const certificate = rawCert.replace(/\\n/g, "\n")
  const response = new NextResponse(certificate, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
  return withCors(response, origin)
}

export const OPTIONS = async (request: Request) => {
  const origin = request.headers.get("origin")
  return withCors(new NextResponse(null, { status: 204 }), origin)
}
