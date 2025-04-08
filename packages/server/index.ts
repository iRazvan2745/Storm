import { Elysia } from 'elysia';
import type { Agent, Target, MonitoringResult, ResponseTimeInterval } from '@storm/shared';
import { logInfo, logWarning, logError } from '@storm/shared';
import { TargetManager } from './targetManager';
import { AgentManager } from './agentManager';
import { ResultsManager } from './resultsManager';
import { swagger } from '@elysiajs/swagger';
import { sendAlert } from './alertManager';

// Define request body types for type safety
interface AgentRegistrationBody {
  name: string;
  location: string;
}

interface ResultsSubmissionBody {
  results: MonitoringResult[];
}

// Create a unique server ID
const serverId = `server-${Date.now()}`;

const apiKey = process.env.API_KEY || '';

if (!apiKey) {
  throw new Error('API_KEY environment variable is not set');
}

// Initialize managers
const targetManager = new TargetManager();
const agentManager = new AgentManager();
const resultsManager = new ResultsManager();

// Simple in-memory cache implementation
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10000; // 10 seconds cache TTL

// Helper function to get or set cached data
async function getCachedData<T>(key: string, ttl: number, dataFn: () => T | Promise<T>): Promise<T> {
  const now = Date.now();
  const cachedItem = cache.get(key);
  
  if (cachedItem && now - cachedItem.timestamp < ttl) {
    logInfo(`Cache hit for ${key}`);
    return cachedItem.data as T;
  }
  
  logInfo(`Cache miss for ${key}, generating fresh data`);
  const freshData = await dataFn();
  cache.set(key, { data: freshData, timestamp: now });
  return freshData;
}

// Create Elysia app
const app = new Elysia()
  .onError(({ code, error, request }) => {
    // Use a type-safe approach to log the error
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error';
    
    const url = request?.url || 'unknown URL';
    logError(`Server error: ${code} - ${errorMessage} at ${url}`);
    
    // Return appropriate error based on code
    if (code === 'NOT_FOUND') {
      return {
        success: false,
        error: 'Resource not found'
      };
    }
    
    return {
      success: false,
      error: 'Internal server error'
    };
  })

  // CORS handling
  .options('*', () => new Response(null, { 
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-agent-id'
    }
  }))
  
  // Add CORS headers to all responses
  .onBeforeHandle(({ set }) => {
    set.headers['Access-Control-Allow-Origin'] = '*';
    set.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    set.headers['Access-Control-Allow-Headers'] = 'Content-Type, x-agent-id';
  })

  .use(swagger())

  // API routes
  .post('/api/register', async ({ body, headers }: { body: AgentRegistrationBody, headers: any }) => {
    // Check API key
    if (headers['x-api-key'] !== apiKey) {
      logWarning('Registration rejected: Invalid API key');
      return {
        success: false,
        error: 'Unauthorized: Invalid API key'
      };
    }
    
    logInfo(`Registration request received for agent: ${body.name} at location: ${body.location}`);
    
    // Validate input data
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      logWarning('Registration rejected: Invalid agent name');
      return {
        success: false,
        error: 'Invalid agent name'
      };
    }
    
    if (!body.location || typeof body.location !== 'string' || body.location.trim() === '') {
      logWarning('Registration rejected: Invalid agent location');
      return {
        success: false,
        error: 'Invalid agent location'
      };
    }
    
    // Create a new agent object
    const agent: Agent = {
      id: '', // Will be assigned by the AgentManager
      name: body.name.trim(),
      location: body.location.trim(),
      status: 'online',
      lastSeen: Date.now(),
    };
    // Send alert about successful agent registration
    await sendAlert(`Agent registered successfully: ${agent.name} (${agent.location})`, undefined, agent);
    // Register the agent and get its ID
    const agentId = agentManager.registerAgent(agent);
    logInfo(`Agent registered successfully: ${agent.name} (${agentId}) at ${agent.location}`);
    
    return { 
      success: true,
      agentId, 
      serverId 
    };
  })

  .post('/api/heartbeat', ({ headers }) => {
    const agentId = headers['x-agent-id'];
    
    if (headers['x-api-key'] !== apiKey) {
      logWarning('Heartbeat rejected: Invalid API key');
      return {
        success: false,
        error: 'Unauthorized: Invalid API key'
      };
    }
    
    if (!agentId) {
      logWarning('Heartbeat received without agent ID');
      return {
        success: false,
        error: 'Agent ID is required'
      };
    }
    
    // Update the agent's last seen timestamp
    const success = agentManager.updateAgentLastSeen(agentId as string);
    
    if (success) {
      return { 
        success: true,
        timestamp: Date.now()
      };
    } else {
      logWarning(`Heartbeat received from unknown agent: ${agentId}`);
      return {
        success: false,
        error: 'Unknown agent'
      };
    }
  })

  .get('/api/targets', ({ headers }) => {
    const agentId = headers['x-agent-id'];
    
    // If the request is from an agent, log it
    if (agentId) {
      logInfo(`Targets requested by agent: ${agentId}`);
      
      // Check if the agent exists
      const agent = agentManager.getAgentById(agentId as string);
      if (!agent) {
        logWarning(`Targets requested by unknown agent: ${agentId}`);
        return {
          success: false,
          error: 'Unknown agent'
        };
      }
    } else {
      logInfo('Targets requested by frontend');
    }
    
    // Get the targets from the TargetManager
    const targets = targetManager.getTargets();
    
    return { 
      success: true,
      targets 
    };
  })

  .post('/api/results', async ({ body, headers }) => {
    try {
      const agentId = headers['x-agent-id'];
      if (!agentId) {
        logWarning('POST /api/results request received without agent ID');
        return {
          success: false,
          error: 'Agent ID is required'
        };
      }
      
      // Check if the agent exists
      const agent = agentManager.getAgentById(agentId as string);
      if (!agent) {
        logWarning(`Results submitted by unknown agent: ${agentId}`);
        return {
          success: false,
          error: 'Unknown agent'
        };
      }
      
      // Validate the request body
      const resultsBody = body as ResultsSubmissionBody;
      if (!resultsBody || !resultsBody.results || !Array.isArray(resultsBody.results)) {
        logWarning(`Invalid results format from agent ${agentId}`);
        return {
          success: false,
          error: 'Invalid results format'
        };
      }
      
      // Update the agent's last seen timestamp
      agentManager.updateAgentLastSeen(agentId as string);
      
      // Process the results
      const count = resultsBody.results.length;
      logInfo(`Processing ${count} results from agent ${agentId}`);
      
      // Store the results
      resultsManager.storeResults(agentId as string, resultsBody.results);
      
      // Clear caches when new data arrives
      cache.delete('latency-data');
      cache.delete('uptime-data');
      cache.delete('target-status');
      
      return { 
        success: true,
        processed: count
      };
    } catch (error) {
      logError(`Error processing results: ${error}`);
      return {
        success: false,
        error: 'Failed to process results'
      };
    }
  })

  .get('/api/results', ({ query }) => {
    const agentId = query.agentId as string | undefined;
    const targetId = query.targetId as string | undefined;
    const date = query.date as string | undefined;
    
    logInfo(`Results data requested${agentId ? ` for agent ${agentId}` : ''}${targetId ? ` for target ${targetId}` : ''}${date ? ` for date ${date}` : ''}`);
    
    // Generate cache key based on query parameters
    const cacheKey = `results-data-${agentId || 'all'}-${targetId || 'all'}-${date || 'all'}`;
    
    try {
      // Use cached data if available
      return getCachedData(cacheKey, CACHE_TTL, () => {
        // Get results from the ResultsManager
        const results = resultsManager.getResults(agentId, targetId, date);
        return {
          success: true,
          results
        };
      });
    } catch (error) {
      logError(`Error getting results data: ${error}`);
      return {
        success: false,
        error: 'Failed to get results data'
      };
    }
  })

  .get('/api/uptime', async ({ query }) => {
    const targetId = query.targetId as string | undefined;
    const date = query.date as string | undefined;
    
    logInfo(`Uptime data requested${targetId ? ` for target ${targetId}` : ' for all targets'}${date ? ` for date ${date}` : ''}`);
    
    // Generate cache key based on query parameters
    const cacheKey = `uptime-data-${targetId || 'all'}-${date || 'all'}`;
    
    try {
      // Use cached data if available
      return getCachedData(cacheKey, CACHE_TTL, async () => {
        // Get uptime data from the ResultsManager
        const uptimeData = await resultsManager.getUptimeData(targetId, date);
        
        // Rename 'targets' to 'results' to match what the frontend expects
        return {
          success: true,
          results: uptimeData.targets || {},
          date: uptimeData.date
        };
      });
    } catch (error) {
      logError(`Error getting uptime data: ${error}`);
      return {
        success: false,
        error: 'Failed to get uptime data',
        results: {}
      };
    }
  })

  .post('/api/uptime/reset', async ({ headers }) => {
    // Check API key for security
    if (headers['x-api-key'] !== apiKey) {
      logWarning('Uptime reset rejected: Invalid API key');
      return {
        success: false,
        error: 'Unauthorized: Invalid API key'
      };
    }
    
    try {
      // Reset all uptime history data
      await resultsManager.resetUptimeData();
      
      logInfo('Uptime history has been reset successfully');
      return {
        success: true,
        message: 'Uptime history has been reset successfully'
      };
    } catch (error) {
      logError(`Error resetting uptime data: ${error}`);
      return {
        success: false,
        error: 'Failed to reset uptime data'
      };
    }
  })

  .get('/api/agents', () => {
    logInfo('Agents list requested');
    
    try {
      // Get the agents from the AgentManager
      const agents = agentManager.getAgents();
      
      return { 
        success: true,
        agents 
      };
    } catch (error) {
      logError(`Error getting agents: ${error}`);
      return {
        success: false,
        error: 'Failed to get agents'
      };
    }
  })

  .get('/metrics', () => {
    try {
      // Get basic system metrics
      const agentCount = agentManager.getAgents().length;
      const targetCount = targetManager.getTargets().length;
      
      // Get more detailed metrics
      const onlineAgents = agentManager.getAgents().filter(agent => agent.status === 'online').length;
      const offlineAgents = agentCount - onlineAgents;
      
      // Get target statuses
      const targetStatuses = resultsManager.getAllTargetStatuses();
      const upTargets = targetStatuses.filter(status => !status.isDown).length;
      const downTargets = targetStatuses.filter(status => status.isDown).length;
      
      // Calculate uptime percentage
      const uptimePercentage = targetCount > 0 ? (upTargets / targetCount) * 100 : 100;
      
      return {
        success: true,
        metrics: {
          server: {
            id: serverId,
            uptime: process.uptime(),
            timestamp: Date.now()
          },
          agents: {
            total: agentCount,
            online: onlineAgents,
            offline: offlineAgents
          },
          targets: {
            total: targetCount,
            up: upTargets,
            down: downTargets,
            uptimePercentage: uptimePercentage
          }
        }
      };
    } catch (error) {
      logError(`Error getting metrics: ${error}`);
      return {
        success: false,
        error: 'Failed to get metrics'
      };
    }
  })

  .get('/api/latency', ({ query }) => {
    const targetId = query.targetId as string | undefined;
    const date = query.date as string | undefined;
    
    logInfo(`Latency data requested${targetId ? ` for target ${targetId}` : ' for all targets'}${date ? ` for date ${date}` : ' for today'}`);
    
    // Generate cache key based on query parameters
    const cacheKey = `latency-data-${targetId || 'all'}-${date || 'today'}`;
    
    try {
      // Use cached data if available
      return getCachedData(cacheKey, CACHE_TTL, () => {
        // Get response time data from the ResultsManager
        const responseTimeData = resultsManager.getResponseTimeAverages(targetId, date);
        
        // Format the data for the frontend
        const latencyData: Record<string, Array<{ timestamp: number, value: number }>> = {};
        
        // Process the response time data safely
        if (responseTimeData) {
          for (const [targetId, agentData] of Object.entries(responseTimeData)) {
            // Initialize the array for this target
            latencyData[targetId] = [];
            
            // Combine data from all agents for this target
            if (agentData && typeof agentData === 'object') {
              for (const [agentId, intervals] of Object.entries(agentData)) {
                if (intervals && Array.isArray(intervals)) {
                  for (const interval of intervals) {
                    if (interval && 
                        typeof interval.startTime === 'number' && 
                        typeof interval.avgResponseTime === 'number') {
                      // Use the start time of the interval as the timestamp
                      latencyData[targetId].push({
                        timestamp: interval.startTime,
                        value: interval.avgResponseTime
                      });
                    }
                  }
                }
              }
            }
            
            // Sort the data points by timestamp
            latencyData[targetId].sort((a, b) => a.timestamp - b.timestamp);
          }
        }
        
        return {
          success: true,
          latencyData
        };
      });
    } catch (error) {
      logError(`Error getting latency data: ${error}`);
      return {
        success: false,
        error: 'Failed to get latency data'
      };
    }
  })

  .get('/api/target-status', () => {
    logInfo('Target status requested');
    
    try {
      // Use cached data if available
      return getCachedData('target-status', CACHE_TTL, () => {
        const statuses = resultsManager.getAllTargetStatuses();
        const targetCount = statuses.length;
        const downTargets = statuses.filter(status => status.isDown).length;
        
        logInfo(`Returning status for ${targetCount} targets, ${downTargets} currently down`);
        
        return { 
          success: true,
          currentStatus: statuses,
          summary: {
            total: targetCount,
            down: downTargets,
            up: targetCount - downTargets
          }
        };
      });
    } catch (error) {
      logError(`Error getting target status: ${error}`);
      return {
        success: false,
        error: 'Failed to get target status'
      };
    }
  })

  // Add the missing endpoint for target updates check
  .get('/api/targets/check-updates', ({ query }) => {
    logInfo('Target updates check requested');
    
    try {
      // Get the last update timestamp from the query
      const lastUpdate = query?.lastUpdate ? parseInt(query.lastUpdate as string, 10) : 0;
      
      // Get all targets
      const targets = targetManager.getTargets();
      
      // Check if there are any updates since the lastUpdate timestamp
      const hasUpdates = targetManager.hasUpdatedSince(lastUpdate);
      
      logInfo(`Checking for target updates since ${new Date(lastUpdate).toISOString()}, hasUpdates: ${hasUpdates}`);
      
      return {
        success: true,
        hasUpdates,
        targets: hasUpdates ? targets : []
      };
    } catch (error) {
      logError(`Error checking for target updates: ${error}`);
      return {
        success: false,
        error: 'Failed to check for target updates'
      };
    }
  })

  .all('*', ({ request }) => {
    const url = new URL(request.url);
    logWarning(`Unhandled request: ${request.method} ${url.pathname}`);
    return new Response('Not Found', { status: 404 });
  })

  // Handle favicon.ico requests to prevent 404 errors
  .get('/favicon.ico', () => {
    return new Response(null, { status: 204 });
  })

// Add this API endpoint to get uptime percentages
app.get('/api/targets/:targetId/uptime', async ({ params }) => {
  try {
    const targetId = Number(params.targetId);
    
    if (isNaN(targetId)) {
      return {
        success: false,
        error: 'Invalid target ID'
      };
    }
    
    const target = targetManager.getTarget(targetId);
    
    if (!target) {
      return {
        success: false,
        error: 'Target not found'
      };
    }
    
    // Convert string targetId to number before passing to getUptimePercentages
    const numericTargetId = Number(targetId);
    
    if (isNaN(numericTargetId)) {
      return {
        success: false,
        error: 'Invalid target ID format'
      };
    }
    
    // Pass the numeric targetId to getUptimePercentages
    const uptimePercentages = await resultsManager.getUptimePercentages(numericTargetId);
    
    return {
      success: true,
      targetId: numericTargetId,
      uptime: uptimePercentages
    };
  } catch (error) {
    logError(`Error getting uptime percentages: ${error}`);
    return {
      success: false,
      error: 'Failed to get uptime percentages'
    };
  }
})

.all('*', ({ request }) => {
  const url = new URL(request.url);
  logWarning(`Unhandled request: ${request.method} ${url.pathname}`);
  return new Response('Not Found', { status: 404 });
})

// Handle favicon.ico requests to prevent 404 errors
.get('/favicon.ico', () => {
  return new Response(null, { status: 204 });
})

// Add uptime data initialization on server startup
async function initializeUptimeData() {
  try {
    logInfo('Initializing uptime data...');
    await resultsManager.initializeUptimeData();
    logInfo('Uptime data initialized successfully');
  } catch (error) {
    logError(`Failed to initialize uptime data: ${error}`);
  }
}

// Add endpoint to force uptime check
app.post('/api/uptime/check', async ({ query, headers }) => {
  // Check API key for security
  if (headers['x-api-key'] !== apiKey) {
    logWarning('Force uptime check rejected: Invalid API key');
    return {
      success: false,
      error: 'Unauthorized: Invalid API key'
    };
  }
  
  try {
    // Get the target ID from the query parameters if provided
    const targetId = query?.targetId ? parseInt(query.targetId as string, 10) : undefined;
    
    // Force an uptime check
    const statuses = await resultsManager.forceUptimeCheck(targetId);
    
    // Clear caches when new data arrives
    cache.delete('latency-data');
    cache.delete('uptime-data');
    cache.delete('target-status');
    
    logInfo(`Force uptime check completed${targetId ? ` for target ${targetId}` : ' for all targets'}`);
    return {
      success: true,
      message: `Uptime check completed${targetId ? ` for target ${targetId}` : ' for all targets'}`,
      statuses: statuses
    };
  } catch (error) {
    logError(`Error forcing uptime check: ${error}`);
    return {
      success: false,
      error: 'Failed to force uptime check'
    };
  }
})

// Modify the server startup section
const startServer = async () => {
  // Initialize data before starting
  logInfo('Loading targets...');
  await targetManager.loadTargetsFromFile();
  logInfo(`Loaded ${targetManager.getTargets().length} targets`);
  
  await initializeUptimeData();

  const PORT = parseInt(process.env.SERVER_PORT || '3000', 10);

  app.listen(PORT, () => {
    logInfo(`Server started on port ${PORT}`);
    logInfo(`Server ID: ${serverId}`);
    logInfo(`Monitoring ${targetManager.getTargets().length} targets`);
    logInfo(`Connected to ${agentManager.getAgents().length} agents`);
    logInfo(`Server is ready to accept connections`);
  });
};

startServer().catch(error => {
  logError(`Server startup failed: ${error}`);
  process.exit(1);
});

// Check for offline agents periodically
setInterval(() => {
  agentManager.checkOfflineAgents();
}, 30000); // Every 30 seconds

// Cleanup cache periodically
setInterval(() => {
  const now = Date.now();
  let expiredCount = 0;
  
  for (const [key, item] of cache.entries()) {
    if (now - item.timestamp > CACHE_TTL * 2) {
      cache.delete(key);
      expiredCount++;
    }
  }
  
  if (expiredCount > 0) {
    logInfo(`Cache cleanup: removed ${expiredCount} expired items`);
  }
}, 60000); // Every minute

// Graceful shutdown handler
function handleShutdown() {
  logInfo('Shutdown signal received, closing server...');
  
  // Save any pending data
  resultsManager.saveData();
  
  // Log the shutdown
  logInfo('Server shutdown complete');
  
  // Exit the process
  process.exit(0);
}

// Export for testing
export { targetManager, agentManager, resultsManager };

// Handle graceful shutdown
process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);