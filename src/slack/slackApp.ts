import { App } from '@slack/bolt';
import { config } from '../config';
import { handleMessage } from './messageHandler';

export async function initializeSlackApp(): Promise<App> {
  const app = new App({
    token: config.slack.botToken,
    signingSecret: config.slack.signingSecret,
    // Use webhook mode for Railway deployment
    socketMode: false,
  });

  // Handle app mentions (@bot-name)
  app.event('app_mention', async ({ event, say, client }) => {
    // Acknowledge immediately (Slack requires response within 3 seconds)
    console.log(`[app_mention] Received mention from user ${event.user} in channel ${event.channel}`);

    try {
      // Process message asynchronously
      await handleMessage({
        text: event.text || '',
        userId: event.user || '',
        channelId: event.channel || '',
        threadTs: event.thread_ts || event.ts,
        ts: event.ts,
        teamId: event.team || '',
        client,
      });
    } catch (error) {
      console.error('Error handling app mention:', error);
      await say({
        text: 'Sorry, I encountered an error processing your message. Please try again.',
        thread_ts: event.thread_ts || event.ts,
      });
    }
  });

  // Handle direct messages
  app.event('message', async ({ event, client }) => {
    // Filter out bot messages and message subtypes we don't want
    if (
      event.subtype ||
      event.bot_id ||
      !('text' in event) ||
      !('user' in event) ||
      !('channel' in event)
    ) {
      return;
    }

    // Only process DMs (channels starting with 'D')
    if (!event.channel.startsWith('D')) {
      return;
    }

    console.log(`[message] Received DM from user ${event.user}`);

    try {
      await handleMessage({
        text: event.text || '',
        userId: event.user || '',
        channelId: event.channel || '',
        threadTs: event.thread_ts || event.ts,
        ts: event.ts,
        teamId: event.team || '',
        client,
      });
    } catch (error) {
      console.error('Error handling DM:', error);
      await client.chat.postMessage({
        channel: event.channel,
        text: 'Sorry, I encountered an error processing your message. Please try again.',
        thread_ts: event.thread_ts,
      });
    }
  });

  // Add health check route to the underlying Express app
  // @ts-ignore - accessing private receiver property
  const receiver = app.receiver;
  if (receiver && (receiver as any).app) {
    (receiver as any).app.get('/health', (req: any, res: any) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });
  }

  return app;
}
