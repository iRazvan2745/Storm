import type { DowntimeRecord, DailyDowntimeRecord, MonitoringResult, ResponseTimeInterval, TargetStatus } from '@storm/shared';
import { logInfo, logWarning, logError } from '@storm/shared';
import { ensureDir, pathExists, readJson, writeJson } from 'fs-extra';
import { resolve, dirname } from 'path';
import { sendAlert } from './alertManager';

export class ResultsManager {
  // Structure: Map<agentId, Map<targetId, Map<date, DailyDowntimeRecord>>>
  private results: Map<string, Map<string, Map<string, DailyDowntimeRecord>>> = new Map();
  private dbPath: string;
  // Track target status across agents
  private targetStatus: Map<string, TargetStatus> = new Map();
  // Minimum number of agents required to report a target as down before considering it actually down
  private minAgentsForDowntime: number = 2;

  constructor(dbDir: string = './data/db') {
    this.dbPath = resolve(dbDir, 'results.json');
    this.loadResultsFromFile();
  }

  private async loadResultsFromFile(): Promise<void> {
    try {
      if (await pathExists(this.dbPath)) {
        const data: Record<string, Record<string, Record<string, DailyDowntimeRecord>>> = await readJson(this.dbPath);
  
        if (data && typeof data === 'object') {
          // Convert the JSON structure back to our Map structure
          this.results = new Map();
  
          // Iterate through agents
          Object.entries(data).forEach(([agentId, agentData]: [string, any]) => {
            if (agentData && typeof agentData === 'object') {
              const agentResults = new Map<string, Map<string, DailyDowntimeRecord>>();
  
              // Iterate through targets for this agent
              Object.entries(agentData).forEach(([targetId, targetData]: [string, any]) => {
                if (targetData && typeof targetData === 'object') {
                  const targetResults = new Map<string, DailyDowntimeRecord>();
  
                  // Iterate through dates for this target
                  Object.entries(targetData).forEach(([date, dailyRecord]: [string, any]) => {
                    if (
                      dailyRecord && // Added check
                      typeof dailyRecord === 'object' &&
                      typeof dailyRecord.downtimeMs === 'number' &&
                      Array.isArray(dailyRecord.incidents)
                    ) {
                      // Validate each incident record
                      const validIncidents = dailyRecord.incidents.filter((record: any) => record && typeof record.startTime === 'number' && (record.endTime === null || typeof record.endTime === 'number'));
                      
                      // Initialize responseTimeIntervals if not present
                      const responseTimeIntervals = Array.isArray(dailyRecord.responseTimeIntervals) 
                        ? dailyRecord.responseTimeIntervals 
                        : [];
                      
                      // Initialize isDown if not present
                      const isDown = typeof dailyRecord.isDown === 'boolean' 
                        ? dailyRecord.isDown 
                        : false;
                      
                      targetResults.set(date, {
                        date,
                        downtimeMs: dailyRecord.downtimeMs,
                        incidents: validIncidents,
                        responseTimeIntervals,
                        isDown
                      });
                      
                      // Update target status map
                      if (isDown) {
                        this.updateTargetStatus(parseInt(targetId), agentId, isDown);
                      }
                    }
                  });
  
                  agentResults.set(targetId, targetResults);
                }
              });
  
              this.results.set(agentId, agentResults);
            }
          });
  
          logInfo(`Loaded results from ${this.dbPath}`);
        }
      } else {
        logInfo(`No results file found at ${this.dbPath}, starting with empty results`);
      }
    } catch (error) {
      logError(`Failed to load results from ${this.dbPath}: ${error}`);
    }
  }

  private async saveResultsToFile(): Promise<void> {
    try {
      // Ensure the directory exists
      await ensureDir(dirname(this.dbPath));
      
      // Convert our Map structure to a JSON-serializable object
      const data: Record<string, Record<string, Record<string, DailyDowntimeRecord>>> = {};
      
      this.results.forEach((agentResults, agentId) => {
        if (agentId) {
          const safeAgentId = agentId; // Create a variable that TypeScript knows is non-null
          data[safeAgentId] = {};
          
          agentResults.forEach((targetResults, targetId) => {
            if (targetId) {
              const safeTargetId = targetId; // Create a variable that TypeScript knows is non-null
              
              // Ensure the nested object exists
              if (!data[safeAgentId]) {
                data[safeAgentId] = {};
              }
              
              data[safeAgentId][safeTargetId] = {};
              
              targetResults.forEach((record, date) => {
                if (date) {
                  const safeDate = date; // Create a variable that TypeScript knows is non-null
                  
                  // Ensure the nested objects exist
                  if (!data[safeAgentId]) {
                    data[safeAgentId] = {};
                  }
                  
                  if (!data[safeAgentId][safeTargetId]) {
                    data[safeAgentId][safeTargetId] = {};
                  }
                  
                  data[safeAgentId][safeTargetId][safeDate] = record;
                }
              });
            }
          });
        }
      });
      
      await writeJson(this.dbPath, data, { spaces: 2 });
      logInfo(`Saved results to ${this.dbPath}`);
    } catch (error) {
      logError(`Failed to save results to ${this.dbPath}: ${error}`);
    }
  }

  // Helper method to get date string in YYYY-MM-DD format
  private getDateString(timestamp: number | undefined): string {
    if (!timestamp) {
      // Add explicit type assertion to ensure TypeScript knows this is a string
      return new Date().toISOString().split('T')[0] as string;
    }
    const date = new Date(timestamp);
    return date.toISOString().split('T')[0] as string;
  }

  // Helper method to calculate downtime duration
  private calculateDowntimeDuration(startTime: number, endTime: number | null): number {
    if (endTime === null) {
      // If the incident is still ongoing, calculate duration up to now
      return Date.now() - startTime;
    } else {
      return endTime - startTime;
    }
  }
  
  // Helper method to get or create a 30-minute interval
  private getOrCreateInterval(intervals: ResponseTimeInterval[], timestamp: number): ResponseTimeInterval {
    // Define 30 minutes in milliseconds
    const THIRTY_MINUTES = 30 * 60 * 1000;
    
    // Calculate the start of the 30-minute interval this timestamp belongs to
    const intervalStart = Math.floor(timestamp / THIRTY_MINUTES) * THIRTY_MINUTES;
    const intervalEnd = intervalStart + THIRTY_MINUTES;
    
    // Look for an existing interval
    let interval = intervals.find(i => 
      i.startTime === intervalStart && i.endTime === intervalEnd
    );
    
    // If no interval exists, create a new one
    if (!interval) {
      interval = {
        startTime: intervalStart,
        endTime: intervalEnd,
        avgResponseTime: 0,
        count: 0
      };
      intervals.push(interval);
    }
    
    return interval;
  }
  
  // Helper method to update the target status map
  private updateTargetStatus(targetId: number, agentId: string, isDown: boolean): void {
    // Validate targetId is a valid number
    if (isNaN(targetId)) {
      logWarning(`Attempted to update status for invalid target ID: NaN from agent ${agentId}`);
      return;
    }
    
    // Get or create the target status
    let status = this.targetStatus.get(targetId.toString());
    if (!status) {
      status = {
        targetId,
        isDown: false,
        agentsReporting: {},
        lastUpdated: Date.now()
      };
      this.targetStatus.set(targetId.toString(), status);
      logInfo(`Created new target status for ${targetId}`);
    }

    if (status) {
      // Update the agent's report
      const previouslyReportedDown = status.agentsReporting[agentId] || false;
      status.agentsReporting[agentId] = isDown;

      if (previouslyReportedDown !== isDown) {
        logInfo(`Agent ${agentId} changed status report for target ${targetId} from ${previouslyReportedDown ? 'DOWN' : 'UP'} to ${isDown ? 'DOWN' : 'UP'}`);
      }

      // Count how many agents are reporting this target as down
      let downCount = 0;
      Object.values(status.agentsReporting).forEach(isAgentReportingDown => {
        if (isAgentReportingDown) downCount++;
      });

      // Determine if the target should be considered down based on our policy
      // For now, we'll say a target is down if at least 2 agents report it as down
      // or if only one agent is monitoring it and it reports it as down
      const totalAgents = Object.keys(status.agentsReporting).length;
      const wasDown = status.isDown;
      
      if (totalAgents === 1) {
        // If only one agent is monitoring, trust its report
        status.isDown = isDown;
      } else {
        // Otherwise, require at least 2 agents to report down
        status.isDown = downCount >= this.minAgentsForDowntime;
      }

      if (wasDown !== status.isDown) {
        logInfo(`Target ${targetId} status changed from ${wasDown ? 'DOWN' : 'UP'} to ${status.isDown ? 'DOWN' : 'UP'} (${downCount}/${totalAgents} agents reporting DOWN)`);
      }
      
      // Update the lastUpdated timestamp
      status.lastUpdated = Date.now();
    }
  }

  private getOrCreateTargetStatus(targetId: number): TargetStatus {
    let status = this.targetStatus.get(targetId.toString());
    if (!status) {
      status = {
        targetId,
        isDown: false,
        agentsReporting: {},
        lastUpdated: Date.now()
      };
      this.targetStatus.set(targetId.toString(), status);
      logInfo(`Created new target status for ${targetId}`);
    }
    return status;
  }

  // Add a monitoring result
  public addResult(agentId: string, result: MonitoringResult): void {
    const targetId = result.targetId;
    const dateString = this.getDateString(result.timestamp);
    
    logInfo(`Processing result from agent ${agentId} for target ${targetId} at ${new Date(result.timestamp).toISOString()}: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
    
    if (result.responseTime !== undefined) {
      logInfo(`Response time for target ${targetId}: ${result.responseTime}ms`);
    }
    
    if (!result.success && result.error) {
      logWarning(`Error reported for target ${targetId}: ${result.error}`);
    }
    
    // Get or create the agent's results map
    let agentResults = this.results.get(agentId);
    if (!agentResults) {
      agentResults = new Map<string, Map<string, DailyDowntimeRecord>>();
      this.results.set(agentId, agentResults);
      logInfo(`Created new results map for agent ${agentId}`);
    }
    
    // Get or create the target's results map
    let targetResults = agentResults.get(targetId.toString());
    if (!targetResults) {
      targetResults = new Map<string, DailyDowntimeRecord>();
      agentResults.set(targetId.toString(), targetResults);
      logInfo(`Created new results map for target ${targetId} under agent ${agentId}`);
    }
    
    // Get or create the daily downtime record
    let dailyRecord = targetResults.get(dateString);
    if (!dailyRecord) {
      dailyRecord = {
        date: dateString,
        downtimeMs: 0,
        incidents: [],
        responseTimeIntervals: [],
        isDown: false
      };
      targetResults.set(dateString, dailyRecord);
      logInfo(`Created new daily record for ${dateString} for target ${targetId} under agent ${agentId}`);
    }
    
    // Update response time intervals
    if (dailyRecord) {
      this.updateResponseTimeIntervals(dailyRecord, result);

      // Update target status based on this result
      this.updateTargetStatus(result.targetId, agentId, !result.success);

      // If the target is down according to our policy, update the downtime record
      const targetStatus = this.getOrCreateTargetStatus(result.targetId);
      const isDown = targetStatus.isDown;

      // Check if we need to start a new incident
      if (isDown && !dailyRecord.isDown) {
        // Target just went down
        const newIncident: DowntimeRecord = {
          startTime: result.timestamp,
          endTime: null
        };
        // Send an alert about the target going down
        sendAlert(
          `Target ${result.targetId} is DOWN: ${result.error || 'Unknown error'}`,
          { id: result.targetId, type: 'http', name: `Target ${result.targetId}`, url: 'Hidden', interval: 10000, timeout: 5000 },
          { id: agentId, name: agentId, location: 'Unknown', status: 'offline', lastSeen: result.timestamp }
        );
        
        // Store the error message in the log but not in the incident record
        // since DowntimeRecord doesn't have an error property
        dailyRecord.incidents.push(newIncident);
        dailyRecord.isDown = true;
        logInfo(`New downtime incident started for target ${result.targetId} at ${new Date(result.timestamp).toISOString()} reported by agent ${agentId}: ${result.error || 'Unknown error'}`);
      } 
      // Check if we need to end an ongoing incident
      else if (!isDown && dailyRecord.isDown) {
        // Target just came back up
        const lastIncident = dailyRecord.incidents[dailyRecord.incidents.length - 1];
        if (lastIncident && lastIncident.endTime === null) {
          lastIncident.endTime = result.timestamp;
          // Calculate and add downtime for this incident
          const downtimeDuration = this.calculateDowntimeDuration(lastIncident.startTime, lastIncident.endTime);
          dailyRecord.downtimeMs += downtimeDuration;
          dailyRecord.isDown = false;
          logInfo(`Downtime incident ended for target ${result.targetId} at ${new Date(result.timestamp).toISOString()} reported by agent ${agentId}. Duration: ${downtimeDuration}ms`);
        }
      }
    }

    // Save the updated results
    this.saveResultsToFile();
  }

  private updateResponseTimeIntervals(dailyRecord: DailyDowntimeRecord, result: MonitoringResult): void {
    // Only update response times for successful checks
    if (!result.success || !result.responseTime) return;

    // Calculate the interval index (each interval is 30 minutes)
    const intervalMs = 30 * 60 * 1000; // 30 minutes in milliseconds
    const startOfDay = new Date(result.timestamp);
    startOfDay.setHours(0, 0, 0, 0);
    const msFromStartOfDay = result.timestamp - startOfDay.getTime();
    const intervalIndex = Math.floor(msFromStartOfDay / intervalMs);
    
    // Calculate start and end times for this interval
    const intervalStartTime = startOfDay.getTime() + (intervalIndex * intervalMs);
    const intervalEndTime = startOfDay.getTime() + ((intervalIndex + 1) * intervalMs) - 1;

    // Find or create the interval
    let interval = dailyRecord.responseTimeIntervals.find(i => 
      i.startTime === intervalStartTime && i.endTime === intervalEndTime
    );
    
    if (!interval) {
      // Create a new interval
      const newInterval: ResponseTimeInterval = {
        startTime: intervalStartTime,
        endTime: intervalEndTime,
        avgResponseTime: result.responseTime,
        count: 1
      };
      dailyRecord.responseTimeIntervals.push(newInterval);
      logInfo(`Created new response time interval for timestamp ${new Date(result.timestamp).toISOString()} with initial value ${result.responseTime}ms`);
    } else {
      // Update the existing interval with the new response time
      const totalResponseTime = interval.avgResponseTime * interval.count;
      interval.count++;
      interval.avgResponseTime = (totalResponseTime + result.responseTime) / interval.count;
      logInfo(`Updated response time interval with new value ${result.responseTime}ms, new average: ${interval.avgResponseTime.toFixed(2)}ms from ${interval.count} checks`);
    }
  }

  // Get results for a specific agent, target, and/or date
  public getResults(agentId?: string, targetId?: string, date?: string): Record<string, any> {
    if (agentId && targetId && date) {
      // Get a specific daily record
      const agentResults = this.results.get(agentId);
      if (agentResults) {
        const targetResults = agentResults.get(targetId.toString());
        if (targetResults) {
          const dailyRecord = targetResults.get(date);
          if (dailyRecord) {
            return { [date]: dailyRecord };
          }
        }
      }
      return {};
    } else if (agentId && targetId) {
      // Get all dates for a specific agent and target
      const agentResults = this.results.get(agentId);
      if (agentResults) {
        const targetResults = agentResults.get(targetId.toString());
        if (targetResults) {
          const results: Record<string, DailyDowntimeRecord> = {};
          targetResults.forEach((record, date) => {
            if (date) {
              const safeDate = date; // Create a variable that TypeScript knows is non-null
              results[safeDate] = record;
            }
          });
          return results;
        }
      }
      return {};
    } else if (agentId) {
      // Get all targets for a specific agent
      const agentResults = this.results.get(agentId);
      if (agentResults) {
        const results: Record<string, Record<string, DailyDowntimeRecord>> = {};
        agentResults.forEach((targetResults, targetId) => {
          if (targetId) {
            const safeTargetId = targetId; // Create a variable that TypeScript knows is non-null
            results[safeTargetId] = {};
            
            // Ensure the nested object exists
            if (!results[safeTargetId]) {
              results[safeTargetId] = {};
            }
            
            targetResults.forEach((record, date) => {
              if (date) {
                const safeDate = date; // Create a variable that TypeScript knows is non-null
                
                // Ensure the nested objects exist
                if (!results[safeTargetId]) {
                  results[safeTargetId] = {};
                }
                
                results[safeTargetId][safeDate] = record;
              }
            });
          }
        });
        return results;
      }
      return {};
    } else {
      // Get all results
      const allResults: Record<string, Record<string, Record<string, DailyDowntimeRecord>>> = {};
      this.results.forEach((agentResults, agentId) => {
        if (agentId) {
          const safeAgentId = agentId; // Create a variable that TypeScript knows is non-null
          allResults[safeAgentId] = {};
          
          agentResults.forEach((targetResults, targetId) => {
            if (targetId) {
              const safeTargetId = targetId; // Create a variable that TypeScript knows is non-null
              
              // Ensure the nested objects exist
              if (!allResults[safeAgentId]) {
                allResults[safeAgentId] = {};
              }
              
              allResults[safeAgentId][safeTargetId] = {};
              
              targetResults.forEach((record, date) => {
                if (date) {
                  const safeDate = date; // Create a variable that TypeScript knows is non-null
                  
                  // Ensure the nested objects exist
                  if (!allResults[safeAgentId]) {
                    allResults[safeAgentId] = {};
                  }
                  
                  if (!allResults[safeAgentId][safeTargetId]) {
                    allResults[safeAgentId][safeTargetId] = {};
                  }
                  
                  allResults[safeAgentId][safeTargetId][safeDate] = record;
                }
              });
            }
          });
        }
      });
      return allResults;
    }
  }

  public getDailyDowntimeSummary(date?: string): Record<string, Record<string, number>> {
    const summary: Record<string, Record<string, number>> = {};
    // Ensure dateToCheck is always a string by using a non-null assertion or default value
    const dateToCheck: string = date || this.getDateString(Date.now());
    
    this.results.forEach((agentResults, agentId) => {
      if (agentId) {
        const safeAgentId = agentId; // Create a variable that TypeScript knows is non-null
        summary[safeAgentId] = {};
        
        agentResults.forEach((targetResults, targetId) => {
          if (targetId && targetResults) {
            const safeTargetId = targetId; // Create a variable that TypeScript knows is non-null
            const dailyRecord = targetResults.get(dateToCheck);
            
            // Ensure the nested object exists
            if (!summary[safeAgentId]) {
              summary[safeAgentId] = {};
            }
            
            if (dailyRecord) {
              // Include any ongoing downtime in the calculation
              let totalDowntime = dailyRecord.downtimeMs;
              
              // Check for ongoing incidents and add their duration
              const ongoingIncident = dailyRecord.incidents.find(incident => incident.endTime === null);
              if (ongoingIncident) {
                totalDowntime += this.calculateDowntimeDuration(ongoingIncident.startTime, null);
              }
              
              summary[safeAgentId][safeTargetId] = totalDowntime;
            } else {
              summary[safeAgentId][safeTargetId] = 0;
            }
          }
        });
      }
    });
    
    return summary;
  }
  
  // New method to get response time averages for 30-minute intervals
  public getResponseTimeAverages(targetId?: string, date?: string): Record<string, any> {
    const dateToCheck: string = date || this.getDateString(Date.now());
    const result: Record<string, any> = {};
    
    // If targetId is provided, get response times for that specific target
    if (targetId) {
      result[targetId] = {};
      
      // Check all agents for this target
      this.results.forEach((agentResults, agentId) => {
        if (agentId) {
          const safeAgentId = agentId;
          const targetResults = agentResults.get(targetId.toString());
          
          if (targetResults) {
            const dailyRecord = targetResults.get(dateToCheck);
            
            if (dailyRecord && dailyRecord.responseTimeIntervals.length > 0) {
              if (!result[targetId][safeAgentId]) {
                result[targetId][safeAgentId] = [];
              }
              
              // Add the intervals to the result
              result[targetId][safeAgentId] = dailyRecord.responseTimeIntervals;
            }
          }
        }
      });
    } else {
      // Get response times for all targets
      this.results.forEach((agentResults, agentId) => {
        if (agentId) {
          const safeAgentId = agentId;
          
          agentResults.forEach((targetResults, targetId) => {
            if (targetId) {
              const safeTargetId = targetId;
              
              if (!result[safeTargetId]) {
                result[safeTargetId] = {};
              }
              
              const dailyRecord = targetResults.get(dateToCheck);
              
              if (dailyRecord && dailyRecord.responseTimeIntervals.length > 0) {
                if (!result[safeTargetId][safeAgentId]) {
                  result[safeTargetId][safeAgentId] = [];
                }
                
                // Add the intervals to the result
                result[safeTargetId][safeAgentId] = dailyRecord.responseTimeIntervals;
              }
            }
          });
        }
      });
    }
    
    return result;
  }
  
  // Get the current status of a target
  public getTargetStatus(targetId: number): TargetStatus | undefined {
    return this.targetStatus.get(targetId.toString());
  }

  // Get all target statuses
  public getAllTargetStatuses(): TargetStatus[] {
    return Array.from(this.targetStatus.values());
  }

  public clearResults(agentId?: string, targetId?: string, date?: string): void {
    if (agentId && targetId && date) {
      // Clear results for a specific agent, target, and date
      const agentResults = this.results.get(agentId);
      if (agentResults) {
        const targetResults = agentResults.get(targetId.toString());
        if (targetResults) {
          targetResults.delete(date);
          this.saveResultsToFile();
        }
      }
    } else if (agentId && targetId) {
      // Clear all dates for a specific agent and target
      const agentResults = this.results.get(agentId);
      if (agentResults) {
        agentResults.set(targetId.toString(), new Map<string, DailyDowntimeRecord>());
        this.saveResultsToFile();
      }
    } else if (agentId) {
      // Clear all targets for a specific agent
      this.results.set(agentId, new Map<string, Map<string, DailyDowntimeRecord>>());
      this.saveResultsToFile();
    } else {
      // Clear all results
      this.results.clear();
      this.saveResultsToFile();
    }
  }

  /**
   * Store multiple monitoring results from an agent
   * @param agentId The ID of the agent submitting results
   * @param results Array of monitoring results to store
   */
  public storeResults(agentId: string, results: MonitoringResult[]): void {
    if (!agentId || !results || !Array.isArray(results)) {
      logWarning(`Invalid parameters for storeResults: agentId=${agentId}, results=${typeof results}`);
      return;
    }

    logInfo(`Storing ${results.length} results from agent ${agentId}`);
    
    // Process each result individually
    let processedCount = 0;
    for (const result of results) {
      // Validate the result has all required fields and targetId is a valid number
      if (result && 
          typeof result.targetId === 'number' && 
          !isNaN(result.targetId) && 
          result.timestamp && 
          typeof result.success === 'boolean') {
        this.addResult(agentId, result);
        processedCount++;
      } else {
        // Log detailed information about the invalid result
        const issues = [];
        if (!result) issues.push('result is null/undefined');
        else {
          if (typeof result.targetId !== 'number') issues.push(`targetId is not a number: ${typeof result.targetId}`);
          else if (isNaN(result.targetId)) issues.push(`targetId is NaN`);
          if (!result.timestamp) issues.push('missing timestamp');
          if (typeof result.success !== 'boolean') issues.push(`success is not a boolean: ${typeof result.success}`);
        }
        
        logWarning(`Skipping invalid result from agent ${agentId}: ${JSON.stringify(result)}. Issues: ${issues.join(', ')}`);
      }
    }
    
    logInfo(`Successfully processed ${processedCount}/${results.length} results from agent ${agentId}`);
    
    // Save results to file after processing all results
    this.saveData();
  }

  /**
   * Save data to persistent storage
   * Alias for saveResultsToFile for API consistency
   */
  public saveData(): Promise<void> {
    return this.saveResultsToFile();
  }

  public getUptimeData(targetId?: string, date?: string): Record<string, any> {
    logInfo(`Retrieving uptime data${targetId ? ` for target ${targetId}` : ''}${date ? ` for date ${date}` : ''}`);
    
    // Get the date to check, defaulting to today
    const dateToCheck = date || this.getDateString(Date.now());
    
    // Get all target statuses
    const statuses: TargetStatus[] = [];
    if (targetId) {
      // Convert string targetId to number since TargetStatus uses number type
      const targetIdNum = parseInt(targetId, 10);
      if (!isNaN(targetIdNum)) {
        const status = this.getTargetStatus(targetIdNum);
        if (status) {
          statuses.push(status);
        }
      } else {
        logWarning(`Invalid target ID format: ${targetId}`);
      }
    } else {
      statuses.push(...this.getAllTargetStatuses());
    }
    
    // Get downtime summary for the specified date
    const downtimeSummary = this.getDailyDowntimeSummary(dateToCheck);
    
    // Get response time data for the specified date
    const responseTimeData = this.getResponseTimeAverages(undefined, dateToCheck);
    
    // Calculate uptime percentages
    const uptimeData: Record<string, any> = {
      date: dateToCheck,
      targets: {}
    };
    
    // Process each target
    for (const status of statuses) {
      const targetDowntime: Record<string, number> = {};
      let totalDowntimeMs = 0;
      
      // Aggregate downtime from all agents for this target
      Object.entries(downtimeSummary).forEach(([agentId, agentDowntime]) => {
        const targetIdStr = status.targetId.toString();
        if (agentDowntime && agentDowntime[targetIdStr] !== undefined) {
          targetDowntime[agentId] = agentDowntime[targetIdStr];
          totalDowntimeMs += agentDowntime[targetIdStr];
        }
      });
      
      // Calculate average downtime if we have data from multiple agents
      const agentCount = Object.keys(targetDowntime).length;
      const avgDowntimeMs = agentCount > 0 ? totalDowntimeMs / agentCount : 0;
      
      // Calculate uptime percentage (out of 24 hours)
      const totalDayMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      const uptimePercentage = ((totalDayMs - avgDowntimeMs) / totalDayMs) * 100;
      
      // Calculate average response time for this target
      let avgResponseTime = 0;
      let totalResponseTime = 0;
      let responseTimeCount = 0;
      
      // Get response time data for this target
      const targetResponseData = responseTimeData[status.targetId.toString()];
      if (targetResponseData) {
        // Aggregate response times from all agents for this target
        Object.entries(targetResponseData).forEach(([agentId, intervals]) => {
          if (intervals && Array.isArray(intervals)) {
            intervals.forEach(interval => {
              if (interval && typeof interval.avgResponseTime === 'number' && typeof interval.count === 'number') {
                totalResponseTime += interval.avgResponseTime * interval.count;
                responseTimeCount += interval.count;
              }
            });
          }
        });
        
        // Calculate the overall average response time
        if (responseTimeCount > 0) {
          avgResponseTime = totalResponseTime / responseTimeCount;
          logInfo(`Calculated average response time for target ${status.targetId}: ${avgResponseTime.toFixed(2)}ms from ${responseTimeCount} data points`);
        }
      }
      
      // Add to the result
      uptimeData.targets[status.targetId.toString()] = {
        targetId: status.targetId,
        isDown: status.isDown,
        downtimeMs: avgDowntimeMs,
        uptimePercentage: Math.min(100, Math.max(0, uptimePercentage)), // Clamp between 0-100
        agentReports: targetDowntime,
        avgResponseTime: avgResponseTime
      };
    }
    
    return uptimeData;
  }
}