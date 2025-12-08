import { NextResponse } from "next/server"
import {
  getSalesMetrics,
  getTopProducts,
  getDailySales,
  getChannelDistribution,
  getServiceTypeDistribution,
} from "@/src/services/reportsService"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const restaurantId = searchParams.get("restaurantId")
    const dateFrom = searchParams.get("date_from")
    const dateTo = searchParams.get("date_to")

    if (!restaurantId) {
      return NextResponse.json({ error: "restaurantId is required" }, { status: 400 })
    }

    const filters = {
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }

    const [metrics, topProducts, dailySales, channels, serviceTypes] = await Promise.all([
      getSalesMetrics(restaurantId, filters),
      getTopProducts(restaurantId, 3, filters),
      getDailySales(restaurantId, filters),
      getChannelDistribution(restaurantId, filters),
      getServiceTypeDistribution(restaurantId, filters),
    ])

    return NextResponse.json({
      metrics,
      topProducts,
      dailySales,
      channels,
      serviceTypes,
    })
  } catch (error) {
    console.error("[v0] Error fetching report metrics:", error)
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 })
  }
}
