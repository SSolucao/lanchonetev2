import { type NextRequest, NextResponse } from "next/server"
import { AuthService } from "@/src/services/authService"

export async function POST(request: NextRequest) {
  try {
    const credentials = await request.json()

    const user = await AuthService.loginWithCredentials(credentials)

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Remove sensitive data before sending
    const { password_hash, ...safeUser } = user

    return NextResponse.json({ user: safeUser })
  } catch (error) {
    console.error("Login API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
