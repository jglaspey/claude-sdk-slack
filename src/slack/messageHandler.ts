import { WebClient } from '@slack/web-api';
import { queryClaudeAgentStream } from '../agent/claudeAgent.js';
import { getSessionManager } from '../agent/sessionManager.js';
import { StreamingUpdater } from './streamingUpdater.js';

export interface MessageContext {
  text: string;
  userId: string;
  channelId: string;
  threadTs: string;
  ts: string;
  teamId: string;
  client: WebClient;
}

/**
 * Generate a unique session key for mapping Slack threads to Claude sessions
 */
function getSessionKey(context: MessageContext): string {
  if (context.channelId.startsWith('D')) {
    // Direct message - use user ID
    return `${context.teamId}-${context.userId}-dm`;
  } else {
    // Channel message - use thread timestamp
    return `${context.teamId}-${context.channelId}-${context.threadTs}`;
  }
}

/**
 * Remove bot mention from message text
 */
function cleanMessageText(text: string): string {
  // Remove bot mention (e.g., "<@U123456789> hello" -> "hello")
  return text.replace(/<@[A-Z0-9]+>/g, '').trim();
}

/**
 * Handle incoming Slack message and query Claude Agent SDK
 */
export async function handleMessage(context: MessageContext): Promise<void> {
  const { client, channelId, threadTs } = context;
  const sessionKey = getSessionKey(context);
  const cleanText = cleanMessageText(context.text);

  console.log(`[handleMessage] Processing message for session: ${sessionKey}`);
  console.log(`[handleMessage] Message text: ${cleanText}`);

  try {
    // Get or create session for this thread
    const sessionManager = getSessionManager();
    const agentSessionId = await sessionManager.getOrCreateSession(sessionKey, {
      teamId: context.teamId,
      channelId: context.channelId,
      userId: context.userId,
      threadTs: context.threadTs,
    });

    console.log(`[handleMessage] Agent session ID: ${agentSessionId || 'new session'}`);

    // Show typing indicator
    const thinkingMessage = await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: '_Processing your request..._',
    });

    // Set up streaming updater
    const updater = new StreamingUpdater(
      client,
      channelId,
      thinkingMessage.ts!,
      3000 // Update every 3 seconds
    );

    // Stream response from Claude Agent SDK
    let newSessionId = agentSessionId;

    for await (const chunk of queryClaudeAgentStream(cleanText, agentSessionId)) {
      if (chunk.type === 'content' && chunk.text) {
        // Add content and update Slack progressively
        await updater.addContent(chunk.text);
      }

      if (chunk.type === 'session' && chunk.sessionId) {
        newSessionId = chunk.sessionId;
      }

      if (chunk.type === 'complete') {
        // Final update without "thinking" indicator
        await updater.finalize();
        
        const stats = updater.getStats();
        console.log(`[handleMessage] Stream complete - ${stats.updateCount} updates, ${stats.contentLength} chars`);
      }
    }

    // Update session with Agent SDK session ID
    if (newSessionId && newSessionId !== agentSessionId) {
      await sessionManager.updateSessionId(sessionKey, newSessionId);
    } else {
      await sessionManager.updateSessionActivity(sessionKey);
    }

    console.log(`[handleMessage] Successfully processed message for session: ${sessionKey}`);
  } catch (error) {
    console.error('[handleMessage] Fatal error:', error);

    // Post error message
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: 'Sorry, I encountered an unexpected error. Please try again or start a new conversation.',
    });
  }
}
