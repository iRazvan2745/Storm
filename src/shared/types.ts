export interface Target {
  id: number;
  url: string;
  name: string;
  interval: number; // in milliseconds
  timeout: number; // in milliseconds
}

export interface CheckResult {
  targetId: number;
  timestamp: number;
  success: boolean;
  responseTime?: number; // in milliseconds
  statusCode?: number;
  error?: string;
  agentId: string;
}

export interface Agent {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline';
  lastSeen: number;
}

export interface ServerConfig {
  port: number;
}

export interface AgentConfig {
  serverId: string;
  serverUrl: string;
  checkInterval: number;
  location: string;
  name: string;
}

export interface DowntimeRecord {
  startTime: number;
  endTime: number | null;
}

export interface ResponseTimeInterval {
  startTime: number; // Start timestamp of the 30-minute interval
  endTime: number; // End timestamp of the 30-minute interval
  avgResponseTime: number; // Average response time in ms for this interval
  count: number; // Number of checks in this interval
}

export interface DailyDowntimeRecord {
  date: string; // ISO date string (YYYY-MM-DD)
  downtimeMs: number; // Total downtime in milliseconds for this day
  incidents: DowntimeRecord[]; // Individual downtime incidents for this day
  responseTimeIntervals: ResponseTimeInterval[]; // 30-minute intervals with average response times
  isDown: boolean; // Current status (true = down, false = up)
}

export interface TargetStatus {
  targetId: number;
  isDown: boolean;
  agentsReporting: {
    [agentId: string]: boolean; // true = reporting down, false = reporting up
  };
  lastUpdated: number;
}

export interface MonitoringResult {
  targetId: number;
  timestamp: number;
  success: boolean;
  responseTime?: number;
  statusCode?: number;
  error?: string;
}