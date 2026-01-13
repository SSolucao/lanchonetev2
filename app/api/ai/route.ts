import { NextResponse } from "next/server"

// Root AI API route - just to ensure the folder is recognized
export async function GET() {
  return NextResponse.json({
    message: "AI API endpoints available",
    endpoints: [
      "GET /api/ai/menu - Get restaurant menu",
      "GET /api/ai/customers?phone=XXX - Find customer by phone",
      "POST /api/ai/customers - Create or update customer by phone",
      "POST /api/ai/orders - Create new order",
    ],
  })
}
