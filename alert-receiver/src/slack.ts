import axios from 'axios';
import { IncidentEvent } from './types/incident';

const SLACK_WEBHOOK_URL = process.env['SLACK_WEBHOOK_URL'] ?? '';

const SEVERITY_EMOJI: Record<string, string> = {
  CRITICAL: ':red_circle:',
  HIGH: ':orange_circle:',
  MEDIUM: ':yellow_circle:',
  LOW: ':white_circle:',
};

export async function notifySlack(event: IncidentEvent): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    console.warn('[Slack] SLACK_WEBHOOK_URL not set — skipping notification');
    return;
  }

  const emoji = SEVERITY_EMOJI[event.severity] ?? ':grey_question:';
  const message = {
    text: `${emoji} *[${event.severity}] Incident Triggered*`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *[${event.severity}] ${event.alertName}*\n*Service:* ${event.service}\n*Source:* ${event.source}\n*Status:* ${event.status}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Description:*\n${event.description}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Incident ID: \`${event.id}\` | ${event.timestamp}`,
          },
        ],
      },
    ],
  };

  try {
    await axios.post(SLACK_WEBHOOK_URL, message);
    console.log(`[Slack] Notification sent for incident ${event.id}`);
  } catch (err) {
    console.error('[Slack] Failed to send notification:', err);
  }
}
