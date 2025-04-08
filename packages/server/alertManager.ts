import { Agent, Target } from "@storm/shared";
import { logError, logInfo } from "@storm/shared";

const discord_webhook = process.env.DISCORD_WEBHOOK;

async function sendAlert(message: string, target?: Target, agent?: Agent) {
  if (!discord_webhook) {
    logError('No webhook environment variable is set (DISCORD_WEBHOOK)');
    return;
  }
  
  const embed: any = {
    description: message,
    color: 3447003, // Blue
    timestamp: new Date().toISOString(),
    fields: []
  };
  
  if (target) {
    embed.title = `Target: ${target.name}`;
    embed.color = 16711680; // Red
    embed.fields.push(
      { name: 'ID', value: `${target.id}`, inline: true },
      { name: 'Type', value: target.type, inline: true }
    );
  } else if (agent) {
    embed.title = `Agent: ${agent.name}`;
    embed.color = 5814783; // Blue
    embed.fields.push(
      { name: 'ID', value: agent.id, inline: true },
      { name: 'Location', value: agent.location, inline: true },
      { name: 'Status', value: agent.status, inline: true }
    );
  }
  
  try {
    const response = await fetch(discord_webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    });
    
    if (response.ok) {
      logInfo(`Alert sent successfully to Discord`);
    } else {
      logError(`Failed to send Discord alert: ${response.statusText}`);
    }
  } catch (error) {
    logError(`Failed to send Discord alert: ${error}`);
  }
}

export { sendAlert };