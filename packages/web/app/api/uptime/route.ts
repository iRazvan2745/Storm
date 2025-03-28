import { NextResponse } from "next/server"

// Define types for the API responses
type UptimeTargetData = {
  isDown: boolean;
  downtimeMs: number;
  avgResponseTime: number;
  targetId?: number;
  uptimePercentage?: number;
  agentReports?: Record<string, number>;
}

type UptimeApiResponse = {
  success?: boolean;
  results: Record<string, UptimeTargetData>;
  date?: string;
  error?: string;
}

type FormattedResults = {
  results: Record<string, Record<string, UptimeTargetData>>;
}

export async function GET(request: Request) {
  try {
    // Check if a specific date was requested
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');
    const targetParam = url.searchParams.get('targetId');
    
    // If a specific date was requested, forward the request to the backend API
    if (dateParam) {
      const apiUrl = `http://localhost:3000/api/uptime${targetParam ? `?targetId=${targetParam}&date=${dateParam}` : `?date=${dateParam}`}`;
      console.log(`Fetching historical data from: ${apiUrl}`);
      
      const backendResponse = await fetch(apiUrl, {
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store"
      });
      
      if (!backendResponse.ok) {
        throw new Error(`Failed to fetch uptime data for date ${dateParam}: ${backendResponse.status}`);
      }
      
      const data = await backendResponse.json() as UptimeApiResponse;
      console.log(`Historical data response for ${dateParam}:`, data);
      
      // Format the data properly for the frontend
      const formattedData: FormattedResults = {
        results: {}
      };
      
      // Check if we have targets data in the response
      if (data.results && typeof data.results === 'object') {
        // For each target in the response
        Object.entries(data.results).forEach(([targetId, targetData]) => {
          if (!formattedData.results[targetId]) {
            formattedData.results[targetId] = {};
          }
          
          // Add the date entry for this target
          if (targetData && typeof targetData === 'object') {
            formattedData.results[targetId][dateParam] = {
              isDown: targetData.isDown || false,
              downtimeMs: targetData.downtimeMs || 0,
              avgResponseTime: targetData.avgResponseTime || 0
            };
          }
        });
      }
      
      console.log(`Formatted historical data for ${dateParam}:`, formattedData);
      return NextResponse.json(formattedData);
    }
    
    // Otherwise, we need to fetch data for multiple dates to build the timeline
    // First, get today's data
    const todayResponse = await fetch("http://localhost:3000/api/uptime", {
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store"
    });
    
    if (!todayResponse.ok) {
      throw new Error(`Failed to fetch today's uptime data: ${todayResponse.status}`);
    }
    
    const todayData = await todayResponse.json() as UptimeApiResponse;
    console.log("Today's data:", todayData);
    
    // Also fetch target status and targets
    const [statusResponse, targetsResponse] = await Promise.all([
      fetch("http://localhost:3000/api/target-status", {
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store"
      }),
      fetch("http://localhost:3000/api/targets", {
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store"
      })
    ]);
    
    // Handle status response
    if (!statusResponse.ok) {
      throw new Error(`Failed to fetch target status: ${statusResponse.status}`);
    }
    const statusData = await statusResponse.json();
    
    // Handle targets response
    if (!targetsResponse.ok) {
      throw new Error(`Failed to fetch targets: ${targetsResponse.status}`);
    }
    const targetsData = await targetsResponse.json();
    
    // Create a map of target IDs to target names
    const targetMap: Record<string | number, string> = {};
    if (targetsData.targets && Array.isArray(targetsData.targets)) {
      targetsData.targets.forEach((target: { id: string | number; name: string }) => {
        if (target && target.id) {
          targetMap[target.id] = target.name;
        }
      });
    }
    
    // Enhance the current status with target names
    const enhancedStatus = statusData.statuses ? statusData.statuses.map((status: { targetId: string | number }) => {
      return {
        ...status,
        name: targetMap[status.targetId] || `Target ${status.targetId}`
      };
    }) : [];
    
    // Now fetch historical data for the past 45 days
    const today = new Date();
    const pastDates: string[] = [];
    
    // Generate array of past 45 days
    for (let i = 0; i < 45; i++) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      pastDates.push(date.toISOString().split('T')[0]);
    }
    
    // Format today's data
    const formattedResults: Record<string, Record<string, UptimeTargetData>> = {};
    
    // Process today's data
    if (todayData.results && typeof todayData.results === 'object') {
      const todayStr = today.toISOString().split('T')[0];
      
      Object.entries(todayData.results).forEach(([targetId, targetData]) => {
        if (!formattedResults[targetId]) {
          formattedResults[targetId] = {};
        }
        
        formattedResults[targetId][todayStr] = {
          isDown: targetData.isDown || false,
          downtimeMs: targetData.downtimeMs || 0,
          avgResponseTime: targetData.avgResponseTime || 0
        };
      });
    }
    
    // Fetch historical data for each past date
    const historicalDataPromises = pastDates.map(async (date) => {
      try {
        const response = await fetch(`http://localhost:3000/api/uptime?date=${date}`, {
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store"
        });
        
        if (!response.ok) {
          console.warn(`Failed to fetch data for ${date}: ${response.status}`);
          return { date, data: null };
        }
        
        const data = await response.json() as UptimeApiResponse;
        return { date, data };
      } catch (error) {
        console.warn(`Error fetching data for ${date}:`, error);
        return { date, data: null };
      }
    });
    
    // Wait for all historical data requests to complete
    const historicalResults = await Promise.all(historicalDataPromises);
    
    // Process historical data
    historicalResults.forEach(({ date, data }) => {
      if (data && data.results && typeof data.results === 'object') {
        Object.entries(data.results).forEach(([targetId, targetData]) => {
          if (!formattedResults[targetId]) {
            formattedResults[targetId] = {};
          }
          
          formattedResults[targetId][date] = {
            isDown: targetData.isDown || false,
            downtimeMs: targetData.downtimeMs || 0,
            avgResponseTime: targetData.avgResponseTime || 0
          };
        });
      }
    });
    
    console.log("Formatted results with historical data:", formattedResults);
    
    // Return the enhanced data
    return NextResponse.json({ 
      results: formattedResults,
      currentStatus: enhancedStatus,
      targetMap
    }, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  } catch (error) {
    console.error("Error fetching uptime data:", error);
    
    // Provide fallback data in case of errors to prevent the UI from breaking
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to fetch uptime data",
        results: {},
        currentStatus: []
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
