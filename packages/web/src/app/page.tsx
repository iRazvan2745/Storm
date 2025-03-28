"use client"

import { useEffect, useState } from "react"
import { CheckCircle, AlertTriangle, XCircle, Loader2 } from "lucide-react"
import StatusPage from "@/components/status-page"
import Footer from "@/components/footer"
import Nav from "@/components/nav"
import type { StatusData } from "@/components/status-page"

type ApiResponse = {
  results: Record<string, StatusData>
  currentStatus: any[]
  targetMap: Record<string, string>
}

export default function Home() {
  const [statusData, setStatusData] = useState<Record<string, StatusData>>({})
  const [targetMap, setTargetMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await fetch("/api/uptime")
        if (!response.ok) {
          throw new Error("Failed to fetch uptime data")
        }
        const result = (await response.json()) as ApiResponse

        // Extract the results and targetMap from the API response
        if (result && result.results) {
          setStatusData(result.results)
          setTargetMap(result.targetMap || {})
        } else {
          console.warn("API response missing expected 'results' structure:", result)
          setStatusData({})
        }
      } catch (error) {
        console.error("Error fetching uptime data:", error)
        setError(error instanceof Error ? error.message : "An unknown error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Calculate overall system status
  const getSystemStatus = () => {
    if (Object.keys(statusData).length === 0) return "unknown"

    let hasOutage = false
    let hasDegraded = false

    Object.values(statusData).forEach((targetData) => {
      // Check the most recent day's data
      const dates = Object.keys(targetData).sort().reverse()
      if (dates.length > 0) {
        const latestData = targetData[dates[0]]
        if (latestData.isDown) {
          hasOutage = true
        } else if (latestData.downtimeMs > 0) {
          hasDegraded = true
        }
      }
    })

    if (hasOutage) return "outage"
    if (hasDegraded) return "degraded"
    return "operational"
  }

  const systemStatus = getSystemStatus()

  const statusConfig = {
    operational: {
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-50",
      borderColor: "border-green-100",
      text: "All systems operational",
    },
    degraded: {
      icon: AlertTriangle,
      color: "text-yellow-500",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-100",
      text: "Some systems experiencing degraded performance",
    },
    outage: {
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-50",
      borderColor: "border-red-100",
      text: "System outage detected",
    },
    unknown: {
      icon: AlertTriangle,
      color: "text-gray-500",
      bgColor: "bg-gray-50",
      borderColor: "border-gray-100",
      text: "System status unknown",
    },
  }

  const StatusIcon = statusConfig[systemStatus].icon

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Nav />
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">System Status</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Monitor the performance and uptime of our services</p>
          </div>

          {!loading && !error && Object.keys(statusData).length > 0 && (
            <div
              className={`mb-8 p-4 rounded-lg border ${statusConfig[systemStatus].borderColor} ${statusConfig[systemStatus].bgColor}`}
            >
              <div className="flex items-center">
                <StatusIcon className={`h-6 w-6 mr-2 ${statusConfig[systemStatus].color}`} />
                <h2 className="text-lg font-medium">{statusConfig[systemStatus].text}</h2>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Loading status data...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-medium mb-2">Error loading uptime data</h3>
              <p>{error}</p>
            </div>
          ) : Object.keys(statusData).length === 0 ? (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-medium mb-2">No status data available</h3>
              <p>There is currently no uptime data to display.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
              {Object.entries(statusData).map(([targetId, data]) => (
                <div
                  key={targetId}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-all hover:shadow-md"
                >
                  <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
                    {targetMap[targetId] || `Target ${targetId}`}
                  </h2>
                  <StatusPage statusData={data} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

