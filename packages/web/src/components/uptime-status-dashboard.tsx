"use client"

import { useEffect, useState } from "react"
import { UptimeStatusCard } from "./uptime-status-card"
import { Skeleton } from "@/components/ui/skeleton"

type StatusData = {
  [date: string]: {
    isDown: boolean
    downtimeMs: number
    avgResponseTime: number
  }
}

type ApiResponse = {
  results: {
    [targetId: string]: StatusData
  }
  currentStatus: any[]
  targetMap: {
    [targetId: string]: string
  }
}

export function UptimeStatusDashboard() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/uptime")
        if (!response.ok) {
          throw new Error("Failed to fetch uptime data")
        }
        const uptimeData = await response.json()
        console.log("UptimeStatusDashboard received data:", uptimeData)
        setData(uptimeData)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return <LoadingSkeleton />
  }

  if (error) {
    return <ErrorDisplay message={error} />
  }

  if (!data || !data.results || Object.keys(data.results).length === 0) {
    return <div>No data available</div>
  }

  return (
    <div className="space-y-8">
      {Object.entries(data.results).map(([targetId, statusData]) => (
        <UptimeStatusCard 
          key={targetId} 
          targetName={data.targetMap?.[targetId] || `Target ${targetId}`} 
          targetId={targetId}
          statusData={statusData} 
        />
      ))}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border rounded-lg p-6 bg-white shadow-sm">
          <Skeleton className="h-8 w-48 mb-4" />
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="border border-red-200 rounded-lg p-6 bg-red-50 text-red-700">
      <h3 className="text-lg font-medium mb-2">Error loading uptime data</h3>
      <p>{message}</p>
      <p className="mt-2">Please try again later or contact support if the issue persists.</p>
    </div>
  )
}
