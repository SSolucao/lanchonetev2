import { type NextRequest, NextResponse } from "next/server"
import { searchDeliveryRulesByNeighborhood } from "@/src/services/deliveryRulesService"
import { getCurrentRestaurant } from "@/src/services/restaurantsService"

export async function GET(request: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const query = (searchParams.get("q") || "").trim()
    const limitParam = Number(searchParams.get("limit") || "10")
    const limit = Number.isFinite(limitParam) ? limitParam : 10
    const minSimilarityParam = Number(searchParams.get("minSimilarity") || "0.3")
    const minSimilarity = Number.isFinite(minSimilarityParam)
      ? Math.min(1, Math.max(0, minSimilarityParam))
      : 0.3

    if (query.length < 2) {
      return NextResponse.json({ query, matches: [] })
    }

    const matches = await searchDeliveryRulesByNeighborhood(restaurant.id, query, limit, minSimilarity)

    return NextResponse.json({
      query,
      minSimilarity,
      matches,
    })
  } catch (error) {
    console.error("Error searching delivery rules:", error)
    return NextResponse.json({ error: "Failed to search delivery rules" }, { status: 500 })
  }
}
