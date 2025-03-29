"use client"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type StatusData = {
  [date: string]: {
    isDown: boolean
    downtimeMs: number
    avgResponseTime: number
  }
}

type UptimeTimelineProps = {
  statusData: StatusData
  targetId?: string | number
}

export function UptimeTimeline({ statusData, targetId }: UptimeTimelineProps) {
  // Get all dates in the last 45 days
  const allDates = getLast45Days()
  
  console.log(`UptimeTimeline for targetId: ${targetId}`, statusData)

  // Check if we have any data for this target
  const hasAnyData = Object.keys(statusData).length > 0

  return (
    <div>
      <TooltipProvider>
        <div className="flex items-center gap-[2px]">
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
      <div className="flex justify-between mt-1 text-xs text-gray-500">
        <span>45 days ago</span>
        <span>Today</span>
      </div>
    </div>
  )
}

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
        <div className={`w-[18px] h-[30px] ${bgColor} rounded-[4px]`} />
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
