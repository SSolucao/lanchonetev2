import type React from "react"
import { ProtectedRoute } from "@/src/components/ProtectedRoute"
import { AppLayout } from "@/src/components/AppLayout"

export default function AppLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  )
}
