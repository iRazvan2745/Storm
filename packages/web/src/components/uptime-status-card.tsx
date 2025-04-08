"use client"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useTargetUptime } from "@/hooks/useTargetUptime"

type StatusData = {
  [date: string]: {
    isDown: boolean
    downtimeMs: number
    avgResponseTime: number
  }
}

type UptimeStatusCardProps = {
  targetName: string
  targetId: string
  statusData: StatusData
}

export function UptimeStatusCard({ targetName, targetId, statusData }: UptimeStatusCardProps) {
  const currentStatus = getCurrentStatus(statusData)
  
  console.log(`UptimeStatusCard for ${targetName} (ID: ${targetId}):`, statusData)

  // Get all dates in the last 45 days
  const allDates = getLast45Days()

  // Get uptime data from the server
  const { day: uptimePercentage } = useTargetUptime(parseInt(targetId, 10))

  return (
    <div className="border rounded-lg p-6 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <StatusIndicator status={currentStatus} />
          <div>
            <div className="font-medium">{formatTargetName(targetName)}</div>
            <div className="text-sm text-gray-500">
              {getStatusText(currentStatus)}
            </div>
          </div>
        </div>
        <div className="text-lg font-medium">{Number(uptimePercentage).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}% uptime</div>
      </div>

      <div className="mt-6">
        <TooltipProvider>
          <div className="flex items-end h-12 gap-1">
            {allDates.map((date) => {
              const dateStr = date.toISOString().split("T")[0]
              const hasData = statusData[dateStr] !== undefined

              return (
                <UptimePill
                  key={dateStr}
                  date={dateStr}
                  hasData={hasData}
                  isDown={hasData ? statusData[dateStr].isDown : false}
                  downtimeMs={hasData ? statusData[dateStr].downtimeMs : 0}
                  avgResponseTime={hasData ? statusData[dateStr].avgResponseTime : 0}
                />
              )
            })}
          </div>
        </TooltipProvider>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>45 days ago</span>
          <span>Today</span>
        </div>
      </div>
    </div>
  )
}

// Removed client-side uptime calculation as we now use server-side calculation

function getLast45Days(): Date[] {
  const dates: Date[] = []
  const today = new Date()

  for (let i = 44; i >= 0; i--) {
    const date = new Date()
    date.setDate(today.getDate() - i)
    dates.push(date)
  }

  return dates
}

function formatTargetName(name: string): string {
  return name.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function getCurrentStatus(statusData: StatusData): "up" | "down" | "degraded" {
  const dates = Object.keys(statusData).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

  if (dates.length === 0) return "up"

  const mostRecentDate = dates[0]
  const mostRecentData = statusData[mostRecentDate]

  if (mostRecentData.isDown) return "down"
  if (mostRecentData.downtimeMs > 0) return "degraded"
  return "up"
}

function getStatusText(status: "up" | "down" | "degraded"): string {
  if (status === "up") return "Operational"
  if (status === "down") return "Down"
  return "Degraded"
}

function StatusIndicator({ status }: { status: "up" | "down" | "degraded" }) {
  if (status === "up") {
    return <div className="w-4 h-4 rounded-full bg-green-500" />
  }

  if (status === "down") {
    return <div className="w-4 h-4 rounded-full bg-red-500" />
  }

  return <div className="w-4 h-4 rounded-full bg-yellow-500" />
}

function UptimePill({
  date,
  hasData,
  isDown,
  downtimeMs,
  avgResponseTime,
}: {
  date: string
  hasData: boolean
  isDown: boolean
  downtimeMs: number
  avgResponseTime: number
}) {
  const formattedDate = new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })

  // Determine color based on status
  let bgColor = "bg-green-500"

  // Consider a day with 0 avgResponseTime and 0 downtimeMs as having no data
  const hasRealData = hasData && (avgResponseTime > 0 || downtimeMs > 0 || isDown)
  
  if (!hasRealData) {
    bgColor = "bg-gray-300"
    hasData = false // Override hasData to treat it as no data
  } else if (isDown) {
    bgColor = "bg-red-500"
  } else if (downtimeMs > 0) {
    bgColor = "bg-yellow-500"
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`w-2 h-full ${bgColor} rounded-sm hover:opacity-80 cursor-pointer transition-all duration-200`}
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="p-2 max-w-xs">
        <div className="font-medium">{formattedDate}</div>
        {!hasRealData && <div className="text-sm mt-1 text-gray-500">No data</div>}
        {hasRealData && isDown && <div className="text-sm mt-1 text-red-600">System down</div>}
        {hasRealData && !isDown && downtimeMs > 0 && (
          <div className="text-sm mt-1">{formatDowntime(downtimeMs)} downtime</div>
        )}
        {hasRealData && !isDown && avgResponseTime > 0 && (
          <div className="text-sm mt-1">{avgResponseTime.toFixed(0)}ms avg response</div>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

function formatDowntime(downtimeMs: number): string {
  if (downtimeMs === 0) return "0"

  const seconds = Math.floor(downtimeMs / 1000)
  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  return `${hours}h`
}
