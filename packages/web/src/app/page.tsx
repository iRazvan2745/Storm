"use client"

import { useEffect, useState } from "react"
import { CheckCircle, AlertTriangle, XCircle, Loader2, Info } from "lucide-react"
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
      text: "All Systems Operational",
    },
    degraded: {
      icon: AlertTriangle,
      color: "text-yellow-500",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-100",
      text: "Some Systems Degraded",
    },
    outage: {
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-50",
      borderColor: "border-red-100",
      text: "System Outage Detected",
    },
    unknown: {
      icon: AlertTriangle,
      color: "text-gray-500",
      bgColor: "bg-gray-50",
      borderColor: "border-gray-100",
      text: "System Status Unknown",
    },
  }

  const StatusIcon = statusConfig[systemStatus].icon

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900">
      <Nav />
      <main className="flex-grow">
        <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Status</h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">Monitor the performance and uptime of our services</p>
          </div>

          {!loading && !error && Object.keys(statusData).length > 0 && (
            <div
              className={`mb-8 p-3 rounded-md border ${statusConfig[systemStatus].borderColor} ${statusConfig[systemStatus].bgColor}`}
            >
              <div className="flex items-center">
                <StatusIcon className={`h-5 w-5 mr-2 ${statusConfig[systemStatus].color}`} />
                <h2 className="text-base font-medium">{statusConfig[systemStatus].text}</h2>
                <span className="ml-auto text-xs text-gray-500">
                  {new Date().toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Loading status data...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-md">
              <h3 className="text-base font-medium mb-1">Error loading uptime data</h3>
              <p className="text-sm">{error}</p>
            </div>
          ) : Object.keys(statusData).length === 0 ? (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 p-4 rounded-md">
              <h3 className="text-base font-medium mb-1">No status data available</h3>
              <p className="text-sm">There is currently no uptime data to display.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(statusData).map(([targetId, data]) => {
                // Calculate uptime percentage
                const totalDays = Object.keys(data).length
                const downtimeDays = Object.values(data).filter((day) => day.isDown || day.downtimeMs > 0).length
                const uptimePercentage =
                  totalDays > 0 ? (((totalDays - downtimeDays) / totalDays) * 100).toFixed(2) : "100.00"

                return (
                  <div key={targetId} className="pb-6">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center">
                        <h2 className="text-base font-medium text-gray-800 dark:text-gray-200">
                          {targetMap[targetId] || `Target ${targetId}`}
                        </h2>
                        <button className="ml-1 text-gray-400 hover:text-gray-500">
                          <Info className="h-4 w-4" />
                          <span className="sr-only">Info</span>
                        </button>
                      </div>
                      <span className="text-sm text-gray-500">{uptimePercentage}%</span>
                    </div>
                    <StatusPage statusData={data} title="" description="" />
                  </div>
                )
              })}
            </div>
          )}

          {!loading && !error && Object.keys(statusData).length > 0 && (
            <div className="mt-12 pt-6 border-t text-center">
              <div className="inline-flex items-center justify-center mb-2">
                <span className="text-gray-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </span>
              </div>
              <h3 className="text-base font-medium mb-1">No recent notices</h3>
              <p className="text-sm text-gray-500">There have been no reports within the last 7 days.</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

