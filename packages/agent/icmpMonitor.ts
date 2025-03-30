import { Target, CheckResult } from '@storm/shared';
import { logInfo, logError } from '@storm/shared';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export class ICMPMonitor {
  private target: Target;
  private agentId: string;

  constructor(target: Target, agentId: string) {
    this.target = target;
    this.agentId = agentId;
  }

  public async check(): Promise<CheckResult> {
    const startTime = Date.now();
    const host = this.target.host || this.target.url;

    try {
      // Use different ping commands based on platform
      const cmd = process.platform === 'win32' 
        ? `ping -n 1 -w ${this.target.timeout} ${host}`
        : `ping -c 1 -W ${Math.ceil(this.target.timeout / 1000)} ${host}`;

      logInfo(`Executing ICMP check for ${host}: ${cmd}`);
      
      const { stdout } = await execAsync(cmd);
      const responseTime = Date.now() - startTime;

      // Parse ping output to get actual response time
      const parsedTime = this.parsePingOutput(stdout);
      
      return {
        targetId: this.target.id,
        timestamp: startTime,
        success: true,
        responseTime: parsedTime || responseTime,
        error: undefined,
        agentId: this.agentId
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logError(`ICMP check failed for ${host}: ${error}`);
      
      return {
        targetId: this.target.id,
        timestamp: startTime,
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Ping failed',
        agentId: this.agentId
      };
    }
  }

  private parsePingOutput(output: string): number | undefined {
    try {
      // Extract time from ping output
      const timeMatch = output.match(/time[=<](\d+\.?\d*)/i);
      if (timeMatch && timeMatch[1]) {
        return parseFloat(timeMatch[1]);
      }
      
      // Fallback for different ping output formats
      const altTimeMatch = output.match(/(\d+\.?\d*)ms/i);
      if (altTimeMatch && altTimeMatch[1]) {
        return parseFloat(altTimeMatch[1]);
      }
    } catch (error) {
      logError(`Failed to parse ping output: ${error}`);
    }
    return undefined;
  }
}