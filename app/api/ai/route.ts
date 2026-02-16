import { NextResponse } from "next/server"

// Root AI API route - just to ensure the folder is recognized
export async function GET() {
  return NextResponse.json({
    message: "AI API endpoints available",
    endpoints: [
      "GET /api/ai/menu - Get restaurant menu",
      "GET /api/ai/menu-documents - List uploaded menu documents",
      "GET /api/ai/menu-documents/assets - List only signed URLs (+description) for menu files",
      "POST /api/ai/menu-documents - Upload menu document (PDF/image)",
      "GET /api/ai/customers?phone=XXX - Find customer by phone",
      "POST /api/ai/customers - Create or update customer by phone",
      "POST /api/ai/customers/v2 - Create/update customer using neighborhood_id + CEP fallback",
      "POST /api/ai/orders - Create new order",
    ],
  })
}
