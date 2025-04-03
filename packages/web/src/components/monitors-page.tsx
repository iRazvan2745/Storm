"use client"

import React, { useEffect, useState, useMemo, useCallback } from "react"
import { LatencyChart } from "./latency-chart"
import { ArrowRight } from "lucide-react"

type LatencyDataPoint = {
  timestamp: number
  value: number
}

type LatencyData = {
  [targetId: string]: LatencyDataPoint[]
}

type Target = {
  id: number
  name: string
  url: string
  interval: number
  timeout: number
}

// Memoized loading skeleton component
const LoadingSkeleton = React.memo(function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-[120px] bg-gray-100 animate-pulse rounded-md"></div>
      ))}
    </div>
  );
});

// Memoized error display component
const ErrorDisplay = React.memo(function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
      Error loading monitor data: {message}
    </div>
  );
});

function MonitorsPage() {
  const [latencyData, setLatencyData] = useState<LatencyData | null>(null)
  const [targets, setTargets] = useState<Target[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Chart colors for different targets - memoized to prevent recreation
  const chartColors = useMemo(() => [
    "#10b981", // Green
    "#10b981", // Green
    "#10b981", // Green
    "#10b981", // Green
  ], []);

  // Helper function to get target name by ID - memoized
  const getTargetNameById = useCallback((targetId: string): string => {
    const target = targets.find(t => t.id.toString() === targetId)
    return target ? target.name : `Target ${targetId}`
  }, [targets]);

  // Optimized data fetching
  useEffect(() => {
    let isMounted = true;
    
    async function fetchData() {
      try {
        // Fetch targets and latency data in parallel
        const [targetsResponse, latencyResponse] = await Promise.all([
          fetch("/api/targets"),
          fetch("/api/latency")
        ]);
        
        if (!isMounted) return;
        
        if (!targetsResponse.ok) {
          throw new Error("Failed to fetch targets");
        }
        
        if (!latencyResponse.ok) {
          throw new Error("Failed to fetch latency data");
        }
        
        const targetsData = await targetsResponse.json();
        const latencyData = await latencyResponse.json();
        
        if (!isMounted) return;
        
        setTargets(targetsData.targets || []);
        setLatencyData(latencyData.latencyData);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "An error occurred");
        console.error(err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Memoize the rendered content to prevent unnecessary re-renders
  const content = useMemo(() => {
    if (loading) {
      return <LoadingSkeleton />;
    }
    
    if (error) {
      return <ErrorDisplay message={error} />;
    }
    
    if (!latencyData || Object.keys(latencyData).length === 0) {
      // Create gray placeholder charts instead of showing "No monitoring data available" message
      return (
        <div>
          <div className="mb-8">
            <h1 className="text-2xl font-semibold">Latency</h1>
            <p className="text-gray-600 mt-4">Response time over the <span className="font-medium">last 7d</span> across <span className="font-medium">all selected regions</span> within a <span className="font-medium">p95 quantile</span>.</p>
          </div>
          
          {/* Generate placeholder charts */}
          {[1, 2, 3].map((index) => (
            <div key={index} className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h3 className="text-base font-medium">Monitor {index}</h3>
                </div>
                <button className="text-xs text-gray-500 hover:text-gray-700 flex items-center">
                  Details <ArrowRight className="ml-1 h-3 w-3" />
                </button>
              </div>
              <div className="w-full bg-white p-4 rounded-md border border-gray-200 mb-6">
                <div className="flex justify-between items-center mb-1">
                  <div>
                    <h3 className="text-base font-medium">Monitor {index}</h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">
                      {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, 
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="flex items-center space-x-1">
                      <span className="text-xs font-medium">Latency</span>
                      <span className="text-xs text-gray-500">-- ms</span>
                    </div>
                  </div>
                </div>
                
                <div className="h-[80px] bg-gray-100 rounded-md"></div>
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-semibold">Latency</h1>
          <p className="text-gray-600 mt-4">Response time over the <span className="font-medium">last 7d</span> across <span className="font-medium">all selected regions</span> within a <span className="font-medium">p95 quantile</span>.</p>
        </div>
        
        {Object.entries(latencyData).map(([targetId, data], index) => {
          // Get the target name from the targets list
          const targetName = getTargetNameById(targetId);
          
          return (
            <div key={targetId} className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h3 className="text-base font-medium">{targetName}</h3>
                </div>
              </div>
              <LatencyChart 
                key={targetId} 
                targetName="" 
                data={data} 
                color={chartColors[index % chartColors.length]} 
              />
            </div>
          );
        })}
      </div>
    );
  }, [loading, error, latencyData, getTargetNameById, chartColors]);

  return (
    <div className={"max-w-[800px] mx-auto  border border-gray-200 rounded-xl p-4 m-4"}>
      {content}
    </div>
  );
}

export { MonitorsPage };
