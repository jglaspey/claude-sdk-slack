import { WebClient } from '@slack/web-api';
import { queryClaudeAgent } from '../agent/claudeAgent';
import { getSessionManager } from '../agent/sessionManager';

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
 * Handle incoming Slack message and query Claude
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
    const conversationHistory = await sessionManager.getOrCreateSession(sessionKey, {
      teamId: context.teamId,
      channelId: context.channelId,
      userId: context.userId,
      threadTs: context.threadTs,
    });

    console.log(`[handleMessage] Using session: ${sessionKey} (history: ${conversationHistory.length} messages)`);

    // Show typing indicator
    // Note: Slack doesn't have a built-in typing indicator for bots
    // We'll post a temporary "thinking" message and update it later
    const thinkingMessage = await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: '_Processing your request..._',
    });

    // Query Claude Agent with conversation history
    const fullResponse = await queryClaudeAgent(cleanText, conversationHistory);

    // Update conversation history with this exchange
    conversationHistory.push(
      { role: 'user', content: cleanText },
      { role: 'assistant', content: fullResponse }
    );
    await sessionManager.updateSession(sessionKey, conversationHistory);

    // Update the thinking message with the actual response
    if (thinkingMessage.ts) {
      await client.chat.update({
        channel: channelId,
        ts: thinkingMessage.ts,
        text: fullResponse || 'I processed your request but have nothing to say.',
      });
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
