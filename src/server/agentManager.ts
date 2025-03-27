import type { Agent } from '../shared/types';
import { logInfo, logWarning, logError } from '../shared/utils';
import { ensureDir, pathExists, readJson, writeJson } from 'fs-extra';
import { resolve, dirname } from 'path';

export class AgentManager {
  private agents: Agent[] = [];
  private readonly OFFLINE_THRESHOLD = 2 * 60 * 1000; // 2 minutes
  private dbPath: string;
  private lastAgentId: number = 0;
  // Add a cache for quick agent lookups
  private agentCache: Map<string, Agent> = new Map();

  constructor(dbDir = './data/db') {
    this.dbPath = resolve(dbDir, 'agents.json');
    this.loadAgentsFromFile();
  }

  private async loadAgentsFromFile(): Promise<void> {
    try {
      if (await pathExists(this.dbPath)) {
        const data = await readJson(this.dbPath);
        if (data && Array.isArray(data.agents)) {
          // Validate agents before replacing the current ones
          const validAgents = data.agents.filter((agent: any) => 
            agent && 
            typeof agent.id === 'string' && 
            typeof agent.name === 'string' && 
            typeof agent.location === 'string' && 
            (agent.status === 'online' || agent.status === 'offline') && 
            typeof agent.lastSeen === 'number'
          );
          
          if (validAgents.length !== data.agents.length) {
            logWarning(`Some agents in the database were invalid and will be ignored.`);
          }
          
          // Set all agents to offline on server startup
          validAgents.forEach((agent: Agent) => {
            agent.status = 'offline';
          });
          
          this.agents = validAgents;
          
          // Update the last agent ID to ensure new IDs are incremental
          this.updateLastAgentId();
          
          // Rebuild the cache
          this.rebuildCache();
          
          logInfo(`Loaded ${this.agents.length} agents from database (all set to offline until they reconnect)`);
        } else {
          logWarning('Invalid agents database format. Expected { agents: Agent[] }');
        }
      } else {
        logInfo(`Agents database file not found at ${this.dbPath}. Starting with empty agents list.`);
      }
    } catch (error) {
      logError(`Failed to load agents from file: ${error}`);
    }
  }
  
  // Rebuild the agent cache for faster lookups
  private rebuildCache(): void {
    this.agentCache.clear();
    for (const agent of this.agents) {
      this.agentCache.set(agent.id, agent);
    }
  }
  
  // Update the last agent ID based on existing agents
  private updateLastAgentId(): void {
    // Extract numeric IDs from existing agents
    const numericIds = this.agents
      .map(agent => {
        const match = agent.id.match(/^agent-(\d+)$/);
        return match && match[1] ? parseInt(match[1], 10) : 0;
      })
      .filter(id => !isNaN(id) && id > 0);
    
    // Set lastAgentId to the highest ID found, or 0 if none
    this.lastAgentId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
  }

  private async saveAgentsToFile(): Promise<void> {
    try {
      await ensureDir(dirname(this.dbPath));
      await writeJson(this.dbPath, { agents: this.agents }, { spaces: 2 });
    } catch (error) {
      logError(`Failed to save agents to file: ${error}`);
    }
  }
  
  // Generate a new incremental agent ID
  private generateAgentId(): string {
    this.lastAgentId++;
    return `agent-${this.lastAgentId}`;
  }

  public registerAgent(agent: Agent): string {
    // Check if an agent with the same name already exists
    const existingAgentWithSameName = this.agents.find(a => a.name === agent.name);
    
    if (existingAgentWithSameName) {
      // Update the existing agent with the same name
      existingAgentWithSameName.location = agent.location;
      existingAgentWithSameName.status = 'online';
      existingAgentWithSameName.lastSeen = Date.now();
      
      // Update the cache
      this.agentCache.set(existingAgentWithSameName.id, existingAgentWithSameName);
      
      logInfo(`Agent reconnected: ${agent.name} (${agent.location}) with ID ${existingAgentWithSameName.id}`);
      this.saveAgentsToFile();
      return existingAgentWithSameName.id;
    }
    
    // This is a new agent, generate an incremental ID
    const newAgent: Agent = {
      ...agent,
      id: this.generateAgentId(),
      status: 'online',
      lastSeen: Date.now()
    };
    
    this.agents.push(newAgent);
    // Add to cache
    this.agentCache.set(newAgent.id, newAgent);
    
    logInfo(`New agent registered: ${newAgent.name} (${newAgent.location}) with ID ${newAgent.id}`);
    
    // Save changes to file
    this.saveAgentsToFile();
    return newAgent.id;
  }

  // Update agent's last seen timestamp (used by the server)
  public updateAgentLastSeen(agentId: string): boolean {
    // Use the cache for faster lookups
    const agent = this.agentCache.get(agentId);
    if (agent) {
      agent.lastSeen = Date.now();
      agent.status = 'online';
      
      // Save changes to file
      this.saveAgentsToFile();
      return true;
    }
    return false;
  }

  public updateAgentStatus(agentId: string): void {
    // Use the cache for faster lookups
    const agent = this.agentCache.get(agentId);
    if (agent) {
      agent.lastSeen = Date.now();
      agent.status = 'online';
      
      // Save changes to file
      this.saveAgentsToFile();
    }
  }

  public checkOfflineAgents(): void {
    const now = Date.now();
    let changed = false;
    
    this.agents.forEach(agent => {
      if (agent.status === 'online' && now - agent.lastSeen > this.OFFLINE_THRESHOLD) {
        agent.status = 'offline';
        changed = true;
        // Update the cache
        this.agentCache.set(agent.id, agent);
        logWarning(`Agent went offline: ${agent.name} (${agent.location})`);
      }
    });
    
    // Only save if there were changes
    if (changed) {
      this.saveAgentsToFile();
    }
  }

  public removeAgent(agentId: string): void {
    const index = this.agents.findIndex(a => a.id === agentId);
    if (index !== -1) {
      const agent = this.agents[index];
      this.agents.splice(index, 1);
      // Remove from cache
      this.agentCache.delete(agentId);
      
      logInfo(`Removed agent: ${agent?.name} (${agent?.location})`);
      
      // Save changes to file
      this.saveAgentsToFile();
    }
  }

  // Get agent by ID (original method)
  public getAgent(agentId: string): Agent | undefined {
    // Use the cache for faster lookups
    return this.agentCache.get(agentId);
  }
  
  // Alias for getAgent to fix lint errors
  public getAgentById(agentId: string): Agent | undefined {
    return this.getAgent(agentId);
  }
  
  public getAgentByName(name: string): Agent | undefined {
    return this.agents.find(a => a.name === name);
  }

  public getAgents(): Agent[] {
    return [...this.agents];
  }
}