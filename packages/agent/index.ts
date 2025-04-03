import type { Agent, AgentConfig, CheckResult, Target } from '@storm/shared';
import { logInfo, logError, logWarning, generateId } from '@storm/shared';
import { ICMPMonitor } from './icmpMonitor';

export class MonitorAgent {
  private agent: Agent;
  private config: AgentConfig;
  private targets: Target[] = [];
  private isRunning = false;
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();
  private lastTargetsUpdate: number = 0;
  private apiKey: string = process.env.API_KEY || '';
    
  constructor(config: AgentConfig) {
    this.config = config;
    if(!this.apiKey) {
      throw new Error('API_KEY environment variable is not set');
    }
    this.agent = {
      id: generateId(),
      name: config.name,
      location: config.location,
      status: 'online',
      lastSeen: Date.now(),
    };
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      logInfo(`Starting agent ${this.agent.name} (${this.agent.id || 'unregistered'}) at ${this.agent.location}`);
      logInfo(`Connecting to server at ${this.config.serverUrl}`);
      
      await this.register();
      this.startHeartbeat();
      
      logInfo(`Fetching targets from server...`);
      await this.fetchTargets();
      this.startTargetChecks();
      this.startTargetUpdateChecks();

      this.isRunning = true;
      logInfo(`Agent successfully started: ${this.agent.name} (${this.agent.id})`);
      logInfo(`Monitoring ${this.targets.length} targets with base interval of ${this.config.checkInterval}ms`);
    } catch (error) {
      logError(`Failed to start agent: ${error}`);
      throw error;
    }
  }

  public stop(): void {
    logInfo(`Stopping agent ${this.agent.name} (${this.agent.id})...`);
    this.isRunning = false;
    this.checkIntervals.forEach((interval) => clearInterval(interval));
    this.checkIntervals.clear();
    logInfo(`Agent stopped: ${this.agent.name} (${this.agent.id})`);
    logInfo(`Cleared ${this.targets.length} monitoring tasks`);
  }

  private async register(): Promise<void> {
    const url = `${this.config.serverUrl}/api/register`;
    const body = JSON.stringify({
      name: this.config.name,
      location: this.config.location
    });

    try {
      const response = await this.retryFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey },
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Registration failed: ${response.status} ${errorText}`);
      }

      const data = await response.json() as { agentId: string; serverId: string };
      this.agent.id = data.agentId;
      this.config.serverId = data.serverId;

      logInfo(`Registered with server: Agent ID ${this.agent.id}, Server ID ${this.config.serverId}`);
    } catch (error) {
      throw new Error(`Failed to register agent: ${error}`);
    }
  }

  private startHeartbeat(): void {
    logInfo(`Starting heartbeat service (interval: 30s)`);
    const heartbeatInterval = setInterval(async () => {
      try {
        logInfo(`Sending heartbeat for agent ${this.agent.name} (${this.agent.id})`);
        const response = await fetch(`${this.config.serverUrl}/api/heartbeat`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-agent-id': this.agent.id,
            'x-api-key': this.apiKey
          },
          body: JSON.stringify({ agentId: this.agent.id }),
        });

        if (!response.ok) {
          logWarning(`Heartbeat failed with status ${response.status}: ${response.statusText}`);
        } else {
          logInfo(`Heartbeat successful`);
        }
      } catch (error) {
        logError(`Heartbeat failed: ${error}`);
      }
    }, 30000);
    
    this.checkIntervals.set('heartbeat', heartbeatInterval);
  }

  private async fetchTargets(): Promise<void> {
    const maxRetries = 3;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        logInfo(`Fetching targets from server (attempt ${retries + 1}/${maxRetries})...`);
        const response = await fetch(
          `${this.config.serverUrl}/api/targets`,
          {
            headers: { 
              'Content-Type': 'application/json',
              'x-agent-id': this.agent.id,
              'x-api-key': this.apiKey
            },
            signal: AbortSignal.timeout(10000)
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch targets: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as { targets: Target[], lastUpdated: number };
        if (!data.targets || !Array.isArray(data.targets)) {
          throw new Error(`Invalid targets data received from server`);
        }
        
        const oldTargetCount = this.targets.length;
        this.updateTargets(data.targets);
        
        const newTargets = data.targets.filter(t => !this.targets.some(existing => existing.id === t.id));
        const removedTargets = this.targets.filter(t => !data.targets.some(newTarget => newTarget.id === t.id));
        
        logInfo(`Successfully fetched ${data.targets.length} targets from server (${oldTargetCount} before, ${this.targets.length} after)`);
        
        if (newTargets.length > 0) {
            logInfo(`New targets: ${newTargets.map(t => `${t.name} (${t.id})`).join(', ')}`);
        }
        
        if (removedTargets.length > 0) {
            logInfo(`Removed targets: ${removedTargets.map(t => `${t.name} (${t.id})`).join(', ')}`);
        }
        
        this.lastTargetsUpdate = data.lastUpdated || Date.now();
        logInfo(`Targets last updated at: ${new Date(this.lastTargetsUpdate).toISOString()}`);
        
        return;
      } catch (error) {
        retries++;
        const waitTime = Math.min(1000 * Math.pow(2, retries), 10000);
        
        if (retries >= maxRetries) {
          logError(`Failed to fetch targets after ${maxRetries} attempts: ${error}`);
          throw error;
        } else {
          logWarning(`Failed to fetch targets (attempt ${retries}/${maxRetries}): ${error}. Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
  }

  private updateTargets(newTargets: Target[]): void {
    logInfo(`Updating targets: clearing ${this.checkIntervals.size} existing monitoring tasks`);
    this.checkIntervals.forEach((interval) => clearInterval(interval));
    this.checkIntervals.clear();

    this.targets = newTargets;
    logInfo(`Setting up ${this.targets.length} new targets for monitoring`);
    this.targets.forEach((target) => this.startTargetCheck(target));
    logInfo(`Target update complete: ${this.targets.length} targets configured`);
    
    this.targets.forEach((target) => {
      logInfo(`Target configured: ${target.name} (${target.id}) - ${target.type === 'icmp' ? 'ICMP' : 'HTTP'} - ${target.type === 'icmp' ? target.host : target.url}, Interval: ${target.interval}ms, Timeout: ${target.timeout}ms`);
    });
  }

  private startTargetChecks(): void {
    this.targets.forEach((target) => this.startTargetCheck(target));
  }

  private startTargetCheck(target: Target): void {
    logInfo(`Setting up monitoring for target: ${target.name} (${target.id}) - Type: ${target.type}`);
    
    const check = async () => {
      if (!this.isRunning) return;

      const startTime = Date.now();
      logInfo(`Checking target: ${target.name} (${target.id}) - ${target.type === 'icmp' ? 'ICMP' : 'HTTP'}`);

      try {
        let result: CheckResult;

        if (target.type === 'icmp') {
          const icmpMonitor = new ICMPMonitor(target, this.agent.id);
          result = await icmpMonitor.check();
        } else {
          // HTTP monitoring
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), target.timeout);

          try {
            const response = await fetch(target.url, {
              method: 'GET',
              headers: { 
                'User-Agent': `Storm/${this.agent.name}`
              },
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            result = {
              targetId: target.id,
              timestamp: endTime,
              success: response.ok,
              statusCode: response.status,
              responseTime,
              error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
              agentId: this.agent.id
            };
          } catch (error) {
            clearTimeout(timeoutId);
            throw error;
          }
        }
        
        if (result.success) {
          logInfo(`Target ${target.name} (${target.id}) is UP. Response time: ${result.responseTime}ms${result.statusCode ? `, Status: ${result.statusCode}` : ''}`);
        } else {
          logWarning(`Target ${target.name} (${target.id}) is DOWN. ${result.error}`);
        }
        
        try {
          logInfo(`Submitting result for target: ${target.name} (${target.id}) - Success: ${result.success}`);
          await this.submitResult(result);
        } catch (error) {
          logError(`Failed to submit result for target ${target.name} (${target.id}): ${error}`);
        }
      } catch (error) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        const isTimeout = error instanceof DOMException && error.name === 'AbortError';
        const errorMessage = isTimeout
          ? `Request timed out after ${target.timeout}ms`
          : `Request failed: ${error}`;
        
        logWarning(`Target ${target.name} (${target.id}) is DOWN. Error: ${errorMessage}`);
        
        const result: CheckResult = {
          targetId: target.id,
          timestamp: endTime,
          success: false,
          statusCode: isTimeout ? 408 : 0,
          responseTime,
          error: errorMessage,
          agentId: this.agent.id
        };
        
        try {
          await this.submitResult(result);
        } catch (error) {
          logError(`Failed to submit result for target ${target.name} (${target.id}): ${error}`);
        }
      }
    };

    const interval = setInterval(check, target.interval);
    this.checkIntervals.set(target.id.toString(), interval);
    logInfo(`Monitoring started for target: ${target.name} (${target.id}) - Interval: ${target.interval}ms`);

    check();
  }

  private async submitResult(result: CheckResult): Promise<void> {
    const maxRetries = 3;
    let retries = 0;
    const targetId = result.targetId;
    
    while (retries < maxRetries) {
      try {
        logInfo(`Submitting result for target ${targetId} (attempt ${retries + 1}/${maxRetries})`);
        const response = await fetch(`${this.config.serverUrl}/api/results`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-agent-id': this.agent.id,
            'x-api-key': this.apiKey
          },
          body: JSON.stringify({ results: [result] }),
          signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
          throw new Error(`Failed to submit result: ${response.status} ${response.statusText}`);
        }
        
        logInfo(`Successfully submitted result for target ${targetId}`);
        return;
      } catch (error) {
        retries++;
        const waitTime = Math.min(1000 * Math.pow(2, retries), 10000);
        
        if (retries >= maxRetries) {
          logError(`Failed to submit result for target ${targetId} after ${maxRetries} attempts: ${error}`);
          throw new Error(`Failed to submit result after ${maxRetries} attempts: ${error}`);
        } else {
          logWarning(`Failed to submit result for target ${targetId} (attempt ${retries}/${maxRetries}): ${error}. Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
  }

  private async retryFetch(url: string, options: RequestInit): Promise<Response> {
    const maxRetries = 3;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        return await fetch(url, options);
      } catch (error) {
        retries++;
        const waitTime = Math.min(1000 * Math.pow(2, retries), 10000);
        
        if (retries >= maxRetries) {
          throw error;
        } else {
          logWarning(`Fetch failed (attempt ${retries}/${maxRetries}): ${error}. Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    throw new Error('Failed to fetch after maximum retries');
  }

  private startTargetUpdateChecks(): void {
    const updateCheckInterval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        const lastUpdateTime = this.lastTargetsUpdate > 0 
          ? new Date(this.lastTargetsUpdate).toISOString() 
          : 'never';
        
        logInfo(`Checking for target updates (last updated: ${lastUpdateTime})...`);
        const response = await fetch(
          `${this.config.serverUrl}/api/targets/check-updates?lastChecked=${this.lastTargetsUpdate || 0}`,
          {
            headers: { 
              'Content-Type': 'application/json',
              'x-agent-id': this.agent.id,
              'x-api-key': this.apiKey
            },
            signal: AbortSignal.timeout(10000)
          }
        );

        if (!response.ok) {
          logWarning(`Failed to check for target updates: ${response.status} ${response.statusText}`);
          return;
        }

        const data = await response.json() as { hasUpdates: boolean, lastUpdated: number };
        
        const serverLastUpdated = typeof data.lastUpdated === 'number' && !isNaN(data.lastUpdated) 
          ? data.lastUpdated 
          : Date.now();
        
        if (data.hasUpdates) {
          logInfo(`Target updates available. Server last updated: ${new Date(serverLastUpdated).toISOString()}`);
          
          this.stopTargetChecks();
          logInfo(`Stopped monitoring for ${this.targets.length} targets to apply updates`);
          
          await this.fetchTargets();
          
          this.startTargetChecks();
          
          logInfo(`Successfully updated targets. Now monitoring ${this.targets.length} targets.`);
        } else {
          logInfo(`No target updates available. Server last updated: ${new Date(serverLastUpdated).toISOString()}`);
        }
      } catch (error) {
        logError(`Error checking for target updates: ${error}`);
      }
    }, 120000);
    
    this.checkIntervals.set('targetUpdates', updateCheckInterval);
    logInfo(`Started periodic target update checks every 2 minutes`);
  }
  
  private stopTargetChecks(): void {
    this.checkIntervals.forEach((interval, key) => {
      if (key !== 'heartbeat' && key !== 'targetUpdates') {
        clearInterval(interval);
        this.checkIntervals.delete(key);
      }
    });
    
    logInfo(`Stopped all target checks`);
  }
}