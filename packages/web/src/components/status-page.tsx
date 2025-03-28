"use client"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type StatusData = {
  [date: string]: {
    isDown: boolean
    downtimeMs: number
    avgResponseTime: number
  }
}

type StatusPageProps = {
  statusData: StatusData
  title?: string
  description?: string
}

export default function StatusPage({
  statusData,
  title = "System Status",
  description = "45-day uptime history",
}: StatusPageProps) {
  // Get all dates in the last 45 days
  const allDates = getLast45Days()

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-green-500"></div>
            <span>Operational</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-yellow-500"></div>
            <span>Degraded</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-red-500"></div>
            <span>Outage</span>
          </div>
        </div>
      </div>

      <TooltipProvider delayDuration={100}>
        <div className="flex items-center gap-[3px] p-4 bg-card rounded-lg border">
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

      <div className="flex justify-between text-xs text-muted-foreground px-1">
        <span>{formatRelativeDate(allDates[0])}</span>
        <span>Today</span>
      </div>
    </div>
  )
}

function getLast45Days(): Date[] {
  const dates: Date[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 44; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    dates.push(date)
  }

  return dates
}

function formatRelativeDate(date: Date): string {
  const diffDays = Math.ceil((new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays > 40) {
    return `${diffDays} days ago`
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
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
    weekday: "short",
    month: "short",
    day: "numeric",
  })

  const hasRealData = hasData && (avgResponseTime > 0 || downtimeMs > 0 || isDown)

  // Determine status and styling
  let status = ""
  let statusColor = "bg-gray-200 dark:bg-gray-700"
  let statusTextColor = ""
  let responseTimeClass = "text-gray-500"

  if (hasRealData) {
    if (isDown) {
      status = "Outage"
      statusColor = "bg-red-500"
      statusTextColor = "text-red-600 font-medium"
    } else if (downtimeMs > 0) {
      status = "Degraded"
      statusColor = "bg-yellow-500"
      statusTextColor = "text-yellow-700 font-medium"
      responseTimeClass = avgResponseTime > 500 ? "text-yellow-700" : "text-gray-700"
    } else {
      status = "Operational"
      statusColor = "bg-green-500"
      statusTextColor = "text-green-600 font-medium"
      responseTimeClass = "text-gray-700"
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "w-[6px] sm:w-[10px] md:w-[18px] h-[30px] rounded-[3px] transition-all hover:scale-110 cursor-pointer",
            statusColor,
          )}
          aria-label={`Status for ${formattedDate}: ${status}`}
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="p-2 bg-white dark:bg-gray-900 shadow-lg rounded-lg border">
        <div className="flex items-center gap-2">
          <div className={cn("h-5 w-1 rounded-full", statusColor)}></div>
          <span className={cn("text-sm font-medium text-black", statusTextColor)}>{status}</span>
          <span className="text-sm text-gray-500">{formattedDate.split(", ")[1]}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function formatDowntime(downtimeMs: number): string {
  if (downtimeMs === 0) return "0s"

  const seconds = Math.floor(downtimeMs / 1000)
  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

