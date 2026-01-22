import { NextResponse } from "next/server"

const ALLOWED_ORIGIN = "https://lanchonetev2.vercel.app"

const withCors = (response: NextResponse) => {
  response.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  response.headers.set("Access-Control-Allow-Headers", "Content-Type")
  return response
}

export const GET = async () => {
  const rawCert = process.env.QZ_CERT_PEM || ""
  if (!rawCert) {
    return withCors(NextResponse.json({ error: "Missing QZ_CERT_PEM" }, { status: 500 }))
  }

  const certificate = rawCert.replace(/\\n/g, "\n")
  return withCors(NextResponse.json({ certificate }))
}

export const OPTIONS = async () => {
  return withCors(new NextResponse(null, { status: 204 }))
}
