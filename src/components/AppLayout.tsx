"use client"

import type React from "react"

import { useAuth } from "@/src/context/AuthContext"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, ShoppingCart, Package, Users, Settings, BarChart3, LogOut, Receipt } from "lucide-react"

const navigationItems = [
  {
    name: "PDV",
    href: "/app/pdv",
    icon: ShoppingCart,
  },
  {
    name: "Comandas",
    href: "/app/comandas",
    icon: Receipt,
  },
  {
    name: "Pedidos",
    href: "/app/pedidos",
    icon: LayoutDashboard,
  },
  {
    name: "Produtos",
    href: "/app/produtos",
    icon: Package,
  },
  {
    name: "Clientes",
    href: "/app/clientes",
    icon: Users,
  },
  {
    name: "Relatórios",
    href: "/app/relatorios",
    icon: BarChart3,
  },
  {
    name: "Configurações",
    href: "/app/configuracoes",
    icon: Settings,
  },
]

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, logout } = useAuth()
  const pathname = usePathname()

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold">POS System</h1>
          <p className="text-sm text-muted-foreground mt-1">{currentUser?.name}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t">
          <Button variant="ghost" className="w-full justify-start" onClick={logout}>
            <LogOut className="w-5 h-5 mr-3" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6">{children}</div>
      </main>
    </div>
  )
}
