import { useState, useEffect } from 'react';

/**
 * Interface for uptime data received from the server.
 * All calculations are performed server-side, the frontend only displays the results.
 */
interface UptimeData {
  day: number;    // Uptime percentage for the last 24 hours
  week: number;   // Uptime percentage for the last 7 days
  month: number;  // Uptime percentage for the last 30 days
  year: number;   // Uptime percentage for the last 365 days
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch uptime data for a specific target from the server.
 * All uptime calculations are performed server-side.
 * @param targetId The ID of the target to fetch uptime data for
 * @returns UptimeData object containing uptime percentages and loading state
 */
export function useTargetUptime(targetId: number): UptimeData {
  const [uptimeData, setUptimeData] = useState<UptimeData>({
    day: 0,
    week: 0,
    month: 0,
    year: 0,
    loading: true,
    error: null
  });

  useEffect(() => {
    const fetchUptimeData = async () => {
      try {
        // Fetch uptime data from the server API
        const response = await fetch(`/api/targets/${targetId}/uptime`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch uptime data: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Simply use the data as provided by the server
        // No calculations are performed on the frontend
        setUptimeData({
          ...data.uptime,
          loading: false,
          error: null
        });
      } catch (error) {
        setUptimeData(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch uptime data'
        }));
      }
    };

    fetchUptimeData();
    
    // Refresh data every 5 minutes
    const intervalId = setInterval(fetchUptimeData, 300000);
    
    return () => clearInterval(intervalId);
  }, [targetId]);

  return uptimeData;
}