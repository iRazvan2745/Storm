import { Agent, Target } from "@storm/shared";
import { logError, logInfo } from "@storm/shared";

const discord_webhook = process.env.DISCORD_WEBHOOK;

async function sendAlert(message: string, target?: Target, agent?: Agent) {
  if (!discord_webhook) {
    logError('DISCORD_WEBHOOK environment variable is not set');
    return;
  }
  
  const payload: any = { content: message };
  
  if (target || agent) {
    payload.embeds = [];
    
    if (target) {
      payload.embeds.push({
        title: `Target: ${target.name}`,
        color: 16711680, // Red
        fields: [
          { name: 'ID', value: `${target.id}`, inline: true },
          { name: 'Type', value: target.type, inline: true },
        ]
      });
    }
    
    if (agent) {
      payload.embeds.push({
        title: `Agent: ${agent.name}`,
        color: 5814783, // Blue
        fields: [
          { name: 'ID', value: agent.id, inline: true },
          { name: 'Location', value: agent.location, inline: true },
          { name: 'Status', value: agent.status, inline: true }
        ]
      });
    }
  }
  
  try {
    const response = await fetch(discord_webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      logInfo(`Alert sent successfully`);
    } else {
      logError(`Failed to send alert: ${response.statusText}`);
    }
  } catch (error) {
    logError(`Failed to send alert: ${error}`);
  }
}

export { sendAlert };