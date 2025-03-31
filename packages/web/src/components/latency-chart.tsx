"use client"

import React, { useMemo, memo } from "react"
import { 
  LineChart, 
  Line, 
  Tooltip, 
  ResponsiveContainer,
  TooltipProps
} from "recharts"

type LatencyDataPoint = {
  timestamp: number
  value: number
}

type LatencyChartProps = {
  targetName: string
  data: LatencyDataPoint[]
  color?: string
}

interface CustomTooltipProps extends TooltipProps<number, string> {
  active?: boolean;
  payload?: Array<{
    payload: {
      timestamp: number;
      time: string;
      latency: number;
    };
  }>;
}

// Memoized tooltip component to prevent unnecessary re-renders
const CustomTooltip = memo(({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const date = new Date(data.timestamp);
    const formattedDate = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    
    return (
      <div className="bg-white px-2 py-1 border border-gray-200 shadow-sm rounded-sm text-xs">
        <div>{formattedDate}, {data.time}</div>
        <div className="flex items-center space-x-1">
          <div className="h-[12px] w-1 bg-green-600 rounded-sm" />
          <div>Latency {data.latency} ms</div>
        </div>
      </div>
    );
  }
  return null;
});

CustomTooltip.displayName = 'CustomTooltip';

// Memoize the entire LatencyChart component
export const LatencyChart = memo(function LatencyChart({ 
  targetName, 
  data, 
  color = "#10b981" 
}: LatencyChartProps) {
  // Memoize the formatted data to prevent recalculation on every render
  const formattedData = useMemo(() => {
    return data.map(point => ({
      time: new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      latency: Math.round(point.value),
      timestamp: point.timestamp
    }));
  }, [data]);

  // Memoize the latest data point calculation
  const latestDataPoint = useMemo(() => {
    return formattedData.length > 0 ? formattedData[formattedData.length - 1] : null;
  }, [formattedData]);
  
  // Memoize the current date/time strings to prevent recalculation
  const currentDateTime = useMemo(() => {
    const now = new Date();
    return {
      date: now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }),
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }, []);

  return (
    <div className="w-full bg-white p-4 rounded-md border border-gray-200 mb-6">
      <div className="flex justify-between items-center mb-1">
        <div>
          <h3 className="text-base font-medium">{targetName}</h3>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">
            {currentDateTime.date}, {currentDateTime.time}
          </span>
          <div className="flex items-center space-x-1">
            <span className="text-xs font-medium">Latency</span>
            <span className="text-xs text-gray-500">{latestDataPoint ? latestDataPoint.latency : '--'} ms</span>
          </div>
        </div>
      </div>
      
      <div className="h-[80px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={formattedData}
            margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
          >
            <Tooltip 
              content={<CustomTooltip />}
              cursor={false}
            />
            <Line
              type="monotone"
              dataKey="latency"
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, fill: color, stroke: "white", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});
