import pkg from '@slack/bolt';
const { App, ExpressReceiver } = pkg;
import type { App as AppType } from '@slack/bolt';
import { config } from '../config.js';
import { handleMessage } from './messageHandler.js';
import type { Request, Response } from 'express';

export async function initializeSlackApp(): Promise<AppType> {
  // Create custom receiver to add health check endpoint
  const receiver = new ExpressReceiver({
    signingSecret: config.slack.signingSecret,
  });

  // Add health check endpoint
  receiver.router.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  const app = new App({
    token: config.slack.botToken,
    receiver,
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

  return app;
}
