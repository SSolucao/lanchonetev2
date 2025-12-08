"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { DollarSign, Package, TrendingUp, Bike } from "lucide-react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

interface ReportMetrics {
  metrics: {
    total_revenue: number
    total_delivery_fees: number
    total_orders: number
    average_ticket: number
  }
  topProducts: Array<{
    product_name: string
    total_quantity: number
    total_revenue: number
  }>
  dailySales: Array<{
    date: string
    total_orders: number
    total_revenue: number
  }>
  channels: Array<{
    channel: string
    total_orders: number
    total_revenue: number
  }>
  serviceTypes: Array<{
    service_type: string
    total_orders: number
    total_revenue: number
  }>
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"]

export default function RelatoriosPage() {
  const [data, setData] = useState<ReportMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [restaurantId, setRestaurantId] = useState<string>("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  useEffect(() => {
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(today.getDate() - 30)

    setDateTo(today.toISOString().split("T")[0])
    setDateFrom(thirtyDaysAgo.toISOString().split("T")[0])
  }, [])

  useEffect(() => {
    async function fetchRestaurantAndData() {
      try {
        const res = await fetch("/api/pdv/initial-data")
        const json = await res.json()
        if (json.restaurant) {
          setRestaurantId(json.restaurant.id)
        }
      } catch (error) {
        console.error("[v0] Error fetching restaurant:", error)
      }
    }
    fetchRestaurantAndData()
  }, [])

  useEffect(() => {
    if (!restaurantId || !dateFrom || !dateTo) return

    async function fetchData() {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          restaurantId,
          date_from: dateFrom,
          date_to: dateTo,
        })
        const res = await fetch(`/api/reports/metrics?${params}`)
        const json = await res.json()
        setData(json)
      } catch (error) {
        console.error("[v0] Error fetching report data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [restaurantId, dateFrom, dateTo])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground mt-2">Análise de vendas e desempenho</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const sortedDays = [...data.dailySales].sort((a, b) => b.total_orders - a.total_orders)
  const bestDay = sortedDays[0]
  const worstDay = sortedDays[sortedDays.length - 1]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground mt-2">Análise de vendas e desempenho</p>
      </div>

      {/* Filtros de Data */}
      <Card>
        <CardHeader>
          <CardTitle>Período</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div>
            <label className="text-sm font-medium">De</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="block w-full rounded-md border border-input px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Até</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="block w-full rounded-md border border-input px-3 py-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Métricas Principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.metrics.total_revenue)}</div>
            <p className="text-xs text-muted-foreground">Sem taxas de entrega</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxas de Entrega</CardTitle>
            <Bike className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.metrics.total_delivery_fees)}</div>
            <p className="text-xs text-muted-foreground">Valor total para motoboy</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.total_orders}</div>
            <p className="text-xs text-muted-foreground">Pedidos concluídos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.metrics.average_ticket)}</div>
            <p className="text-xs text-muted-foreground">Por pedido</p>
          </CardContent>
        </Card>
      </div>

      {/* Top 3 Produtos */}
      <Card>
        <CardHeader>
          <CardTitle>Top 3 Produtos Mais Vendidos</CardTitle>
          <CardDescription>Produtos com maior quantidade vendida</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.topProducts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="product_name" />
              <YAxis />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === "total_revenue") return formatCurrency(value)
                  return value
                }}
              />
              <Legend />
              <Bar dataKey="total_quantity" name="Quantidade" fill="#8884d8" />
              <Bar dataKey="total_revenue" name="Faturamento" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Melhores e Piores Dias */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Melhor Dia</CardTitle>
            <CardDescription>Dia com mais pedidos</CardDescription>
          </CardHeader>
          <CardContent>
            {bestDay && (
              <div>
                <div className="text-2xl font-bold">{new Date(bestDay.date).toLocaleDateString("pt-BR")}</div>
                <p className="text-sm text-muted-foreground">{bestDay.total_orders} pedidos</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(bestDay.total_revenue)} faturado</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pior Dia</CardTitle>
            <CardDescription>Dia com menos pedidos</CardDescription>
          </CardHeader>
          <CardContent>
            {worstDay && (
              <div>
                <div className="text-2xl font-bold">{new Date(worstDay.date).toLocaleDateString("pt-BR")}</div>
                <p className="text-sm text-muted-foreground">{worstDay.total_orders} pedidos</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(worstDay.total_revenue)} faturado</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Vendas Diárias */}
      <Card>
        <CardHeader>
          <CardTitle>Vendas Diárias</CardTitle>
          <CardDescription>Evolução de pedidos e faturamento</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.dailySales}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(date) =>
                  new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                }
              />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip
                labelFormatter={(date) => new Date(date).toLocaleDateString("pt-BR")}
                formatter={(value: number, name: string) => {
                  if (name === "Faturamento") return formatCurrency(value)
                  return value
                }}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="total_orders" name="Pedidos" stroke="#8884d8" />
              <Line yAxisId="right" type="monotone" dataKey="total_revenue" name="Faturamento" stroke="#82ca9d" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Distribuições */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Por Canal</CardTitle>
            <CardDescription>Distribuição de pedidos por origem</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data.channels}
                  dataKey="total_orders"
                  nameKey="channel"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {data.channels.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Por Tipo de Serviço</CardTitle>
            <CardDescription>Distribuição de pedidos por modalidade</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data.serviceTypes}
                  dataKey="total_orders"
                  nameKey="service_type"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {data.serviceTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
