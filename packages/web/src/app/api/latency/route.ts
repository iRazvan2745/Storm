import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Fetch results data from the Storm server
    const resultsResponse = await fetch("http://localhost:3000/api/latency", {
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store" // Don't cache the response
    });

    if (!resultsResponse.ok) {
      console.error(`Failed to fetch results: ${resultsResponse.status}`);
      // Try to get the error message from the response
      const errorText = await resultsResponse.text().catch(() => "Unknown error");
      throw new Error(`Failed to fetch results: ${errorText}`);
    }

    const resultsData = await resultsResponse.json();
    
    // Check if the response contains the expected data
    if (!resultsData.success) {
      throw new Error(resultsData.error || "Failed to fetch latency data from server");
    }
    
    // Log success for debugging
    console.log("Successfully fetched latency data from Storm server");
    
    // Return the processed data
    return NextResponse.json({ 
      latencyData: resultsData.latencyData || {}
    }, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  } catch (error) {
    console.error("Error fetching latency data:", error);
    
    // Provide fallback data in case of errors to prevent the UI from breaking
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to fetch latency data",
        latencyData: {}
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        }
      }
    );
  }
}

// Process the raw results data into a format suitable for charts
function processLatencyData(results: any) {
  const latencyData: Record<string, Array<{ timestamp: number, value: number }>> = {};
  
  // If results is empty or not an object, return empty data
  if (!results || typeof results !== 'object') {
    return latencyData;
  }
  
  // Process the data for each target
  for (const [targetId, targetData] of Object.entries(results)) {
    if (!targetData || typeof targetData !== 'object') continue;
    
    latencyData[targetId] = [];
    
    // Process data from each agent for this target
    for (const [agentId, agentData] of Object.entries(targetData as Record<string, any>)) {
      if (!agentData || typeof agentData !== 'object') continue;
      
      // Get all dates for this agent/target
      for (const [date, dateData] of Object.entries(agentData as Record<string, any>)) {
        if (!dateData || typeof dateData !== 'object') continue;
        
        // Extract response time intervals
        const intervals = (dateData as any).responseTimeIntervals;
        if (intervals && Array.isArray(intervals)) {
          for (const interval of intervals) {
            if (interval && typeof interval === 'object' && 
                typeof interval.startTime === 'number' && 
                typeof interval.avgResponseTime === 'number') {
              latencyData[targetId].push({
                timestamp: interval.startTime,
                value: interval.avgResponseTime
              });
            }
          }
        }
      }
    }
    
    // Sort data points by timestamp
    latencyData[targetId].sort((a, b) => a.timestamp - b.timestamp);
  }
  
  return latencyData;
}
