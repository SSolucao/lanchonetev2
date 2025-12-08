import { createClient } from "@/lib/supabase/server"
import type { User } from "@/src/domain/types"

export interface LoginCredentials {
  login: string
  password: string
}

export class AuthService {
  /**
   * Authenticate user with login and password
   * For now, using plain text comparison
   * TODO: Implement proper password hashing (bcrypt) in production
   */
  static async loginWithCredentials(credentials: LoginCredentials): Promise<User | null> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("login", credentials.login)
        .eq("password_hash", credentials.password)
        .single()

      if (error || !data) {
        return null
      }

      return data as User
    } catch (error) {
      console.error("Login error:", error)
      return null
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<User | null> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase.from("users").select("*").eq("id", userId).single()

      if (error || !data) {
        return null
      }

      return data as User
    } catch (error) {
      console.error("Get user error:", error)
      return null
    }
  }
}
