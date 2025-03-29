"use client"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import formatDuration from "date-fns/formatDuration"
import { formatDowntime } from "./uptime-timeline"

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
  showLegend?: boolean
}

export default function StatusPage({ statusData, title = "", description = "", showLegend = false }: StatusPageProps) {
  // Use the latest available date in statusData as our reference.
  const allDates = getLast45Days(statusData)

  return (
    <div className="w-full space-y-1">
      {(title || description || showLegend) && (
        <div className="flex items-center justify-between mb-2">
          {(title || description) && (
            <div>
              {title && <h2 className="text-lg font-semibold">{title}</h2>}
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
          )}
        </div>
      )}

      <TooltipProvider delayDuration={100}>
        <div className="flex items-center gap-[3px]">
          {allDates.map((date) => {
            const dateStr = formatDateKey(date)
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

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>45 days ago</span>
      </div>
    </div>
  )
}

/**
 * Generates an array of the last 45 days using the latest date in statusData as the reference.
 * If statusData is empty, it falls back to today's date.
 * Dates are so fucking annoying
 */
function getLast45Days(statusData: StatusData): Date[] {
  let referenceDate = new Date()
  const dataDates = Object.keys(statusData)
  if (dataDates.length > 0) {
    // Use parseDateLocal to get a local date instead of UTC.
    referenceDate = parseDateLocal(dataDates.sort().reverse()[0])
  }
  // Ensure time is set to midnight.
  referenceDate.setHours(0, 0, 0, 0)

  const dates: Date[] = []
  for (let i = 44; i >= 0; i--) {
    const d = new Date(referenceDate)
    d.setDate(referenceDate.getDate() - i)
    dates.push(d)
  }
  return dates
}

/**
 * Parses a "YYYY-MM-DD" string as a local date.
 */
function parseDateLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Formats a Date object as "YYYY-MM-DD" in local time.
 */
function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
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

  // Determine status and styling based on the data.
  let status = ""
  let statusColor = "bg-gray-200 dark:bg-gray-700"
  let statusTextColor = ""
  if (hasRealData) {
    if (isDown) {
      status = "Outage"
      statusColor = "bg-red-500"
      statusTextColor = "text-red-600 font-medium"
    } else if (downtimeMs > 0) {
      status = "Degraded"
      statusColor = "bg-yellow-500"
      statusTextColor = "text-yellow-700 font-medium"
    } else {
      status = "Operational"
      statusColor = "bg-green-500"
      statusTextColor = "text-green-600 font-medium"
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "w-[6px] sm:w-[8px] h-[30px] rounded-[3px] transition-all hover:scale-110 cursor-pointer",
            statusColor
          )}
          aria-label={`Status for ${formattedDate}: ${status}`}
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="p-2 bg-white dark:bg-gray-900 shadow-lg rounded-lg border">
        <div className="flex items-center gap-2">
          <div className={cn("h-8 w-1 rounded-full", statusColor)}></div>
          <div className="flex flex-col">
            <span className={cn("text-sm font-medium text-black dark:text-white", statusTextColor)}>
              {hasRealData ? status : "No data"}
            </span>
            <span className={cn("text-sm font-medium text-black dark:text-white")}>
              {hasRealData && downtimeMs > 0 ? formatDowntime(downtimeMs) : "No downtime"}
            </span>
          </div>
          <span className="text-sm text-gray-500">
            {formattedDate.split(", ")[1] || formattedDate}
          </span>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
