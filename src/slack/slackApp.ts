// ABOUTME: Slack Bolt app initialization and event handlers
// ABOUTME: Handles app_mention events and routes them to the Claude agent

import pkg from '@slack/bolt';
const { App, ExpressReceiver } = pkg;
import { SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET } from '../config.js';
import { handleMessage } from './messageHandler.js';

// Create Express receiver for custom routing
const receiver = new ExpressReceiver({
  signingSecret: SLACK_SIGNING_SECRET,
  endpoints: '/slack/events'
});

// Initialize Slack app
export const slackApp = new App({
  token: SLACK_BOT_TOKEN,
  receiver
});

// Handle @mentions of the bot
slackApp.event('app_mention', async ({ event, client, say }) => {
  try {
    console.log('📨 Received app_mention:', event);

    // Remove the bot mention from the message text
    const userMessage = event.text.replace(/<@[^>]+>/g, '').trim();

    if (!userMessage) {
      await say('Hello! How can I help you?');
      return;
    }

    // Send thinking indicator
    await client.chat.postMessage({
      channel: event.channel,
      text: '🤔 Thinking...',
      thread_ts: event.ts
    });

    // Process message with Claude agent
    const response = await handleMessage(userMessage, event.user || 'unknown', event.channel);

    // Send response
    await say({
      text: response,
      thread_ts: event.ts
    });

  } catch (error) {
    console.error('Error handling app_mention:', error);
    await say({
      text: '❌ Sorry, I encountered an error processing your request.',
      thread_ts: event.ts
    });
  }
});

// Handle direct messages
slackApp.event('message', async ({ event, say }) => {
  // Ignore bot messages and threaded messages (already handled by app_mention)
  // @ts-ignore - thread_ts exists on GenericMessageEvent
  if (event.subtype === 'bot_message' || event.thread_ts) {
    return;
  }

  try {
    // @ts-ignore - event type doesn't include text but it exists
    const userMessage = event.text;

    if (!userMessage) return;

    console.log('📨 Received DM:', event);

    // Send thinking indicator
    await say('🤔 Thinking...');

    // Process message with Claude agent
    // @ts-ignore - event type doesn't include user but it exists
    const response = await handleMessage(userMessage, event.user, event.channel);

    // Send response
    await say(response);

  } catch (error) {
    console.error('Error handling message:', error);
    await say('❌ Sorry, I encountered an error processing your request.');
  }
});

console.log('✅ Slack app initialized');
