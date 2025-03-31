"use client"

import { useEffect, useState } from "react"
import { UptimeStatusCard } from "./uptime-status-card"
import { Skeleton } from "@/components/ui/skeleton"

interface TargetStatus {
  targetId: number;
  isDown: boolean;
  agentsReporting: {
    [agentId: string]: boolean; // true = reporting down, false = reporting up
  };
  lastUpdated: number;
}

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
  currentStatus: TargetStatus[]
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
    // Use targetMap if available to show placeholders for actual targets
    const targetEntries = data?.targetMap ? Object.entries(data.targetMap) : [];
    
    // If we have targetMap data, use it to create placeholders for each target
    if (targetEntries.length > 0) {
      return (
        <div className="space-y-8">
          {targetEntries.map(([targetId, targetName]) => (
            <div key={targetId} className="border rounded-lg p-6 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-gray-300" />
                  <div>
                    <div className="font-medium">{targetName}</div>
                    <div className="text-sm text-gray-500">No status</div>
                  </div>
                </div>
                <div className="text-lg font-medium text-gray-400">--% uptime</div>
              </div>

              <div className="mt-6">
                <div className="flex items-end h-12 gap-1">
                  {Array.from({ length: 45 }).map((_, index) => (
                    <div
                      key={index}
                      className="w-2 h-full bg-gray-300 rounded-sm"
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>45 days ago</span>
                  <span>Today</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    // Fallback to generic placeholders if no targetMap is available
    return (
      <div className="space-y-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border rounded-lg p-6 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gray-300" />
                <div>
                  <div className="font-medium">Monitor {i}</div>
                  <div className="text-sm text-gray-500">No status</div>
                </div>
              </div>
              <div className="text-lg font-medium text-gray-400">--% uptime</div>
            </div>

            <div className="mt-6">
              <div className="flex items-end h-12 gap-1">
                {Array.from({ length: 45 }).map((_, index) => (
                  <div
                    key={index}
                    className="w-2 h-full bg-gray-300 rounded-sm"
                  />
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>45 days ago</span>
                <span>Today</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
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
