import { MonitorAgent } from './index';
import type { AgentConfig } from '@storm/shared';
import { config } from 'dotenv';
import { logError, logInfo } from '@storm/shared';
import * as os from 'os';

// Load environment variables
config();

// Validate required environment variables
function validateEnv() {
  const requiredVars = ['SERVER_URL'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    logError(`Missing required environment variables: ${missing.join(', ')}`);
    logError('Please set these variables in your .env file or environment before starting the agent');
    process.exit(1);
  }
}

validateEnv();

// Agent configuration
const agentConfig: AgentConfig = {
  serverId: process.env.SERVER_ID || '',
  serverUrl: process.env.SERVER_URL || 'http://localhost:3000',
  name: process.env.AGENT_NAME || os.hostname(),
  location: process.env.AGENT_LOCATION || 'Unknown',
  checkInterval: parseInt(process.env.CHECK_INTERVAL || '60000', 10),
};

logInfo(`Starting agent: ${agentConfig.name} (${agentConfig.location})`);
logInfo(`Connecting to server: ${agentConfig.serverUrl}`);

// Create and start the agent
const agent = new MonitorAgent(agentConfig);

// Handle process termination
process.on('SIGINT', async () => {
  logInfo('Stopping agent...');
  await agent.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logInfo('Stopping agent...');
  await agent.stop();
  process.exit(0);
});

// Start the agent
try {
  await agent.start();
  logInfo(`Agent started successfully. Monitoring targets every ${agentConfig.checkInterval / 1000} seconds.`);
} catch (error) {
  logError(`Failed to start agent: ${error}`);
  process.exit(1);
}