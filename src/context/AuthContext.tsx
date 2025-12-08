"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import type { User } from "@/src/domain/types"
import type { LoginCredentials } from "@/src/services/authService"

interface AuthContextType {
  currentUser: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const SESSION_KEY = "pos_user_session"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Load session from localStorage on mount
  useEffect(() => {
    const loadSession = () => {
      try {
        const sessionData = localStorage.getItem(SESSION_KEY)
        if (sessionData) {
          const user = JSON.parse(sessionData) as User
          setCurrentUser(user)
        }
      } catch (error) {
        console.error("Failed to load session:", error)
        localStorage.removeItem(SESSION_KEY)
      } finally {
        setIsLoading(false)
      }
    }

    loadSession()
  }, [])

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      // Call the auth service via API route
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      })

      if (!response.ok) {
        return false
      }

      const { user } = await response.json()

      if (user) {
        setCurrentUser(user)
        localStorage.setItem(SESSION_KEY, JSON.stringify(user))
        return true
      }

      return false
    } catch (error) {
      console.error("Login failed:", error)
      return false
    }
  }

  const logout = () => {
    setCurrentUser(null)
    localStorage.removeItem(SESSION_KEY)
    router.push("/login")
  }

  const value: AuthContextType = {
    currentUser,
    isAuthenticated: currentUser !== null,
    isLoading,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
