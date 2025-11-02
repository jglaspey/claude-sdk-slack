import { WebClient } from '@slack/web-api';
import { queryClaudeAgentStream } from '../agent/claudeAgent.js';
import { getSessionManager } from '../agent/sessionManager.js';
import { StreamingUpdater } from './streamingUpdater.js';
import { ProgressIndicator } from './progressIndicator.js';
import { config } from '../config.js';

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
 * Extract user mentions from message text
 */
async function extractUserMentions(
  text: string,
  client: WebClient
): Promise<Array<{ id: string; name: string; realName: string }>> {
  const mentionPattern = /<@(U[A-Z0-9]+)>/g;
  const mentions: Array<{ id: string; name: string; realName: string }> = [];

  let match;
  while ((match = mentionPattern.exec(text)) !== null) {
    const userId = match[1];
    try {
      const userInfo = await client.users.info({ user: userId });
      if (userInfo.user) {
        mentions.push({
          id: userId,
          name: userInfo.user.name || 'unknown',
          realName: userInfo.user.real_name || 'Unknown User',
        });
      }
    } catch (error) {
      console.warn(`[extractUserMentions] Failed to fetch user info for ${userId}:`, error);
    }
  }

  return mentions;
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
    // Extract user mentions from the message
    const mentions = await extractUserMentions(context.text, client);
    const mentionContext = mentions.length > 0
      ? `\n\nNote: This message mentions: ${mentions.map(m => `@${m.name} (${m.realName})`).join(', ')}`
      : '';
    
    if (mentions.length > 0) {
      console.log(`[handleMessage] Detected ${mentions.length} user mention(s):`, mentions.map(m => m.name));
    }

    // Prepare prompt with mention context
    const promptWithContext = cleanText + mentionContext;

    // Get or create session for this thread
    const sessionManager = getSessionManager();
    const agentSessionId = await sessionManager.getOrCreateSession(sessionKey, {
      teamId: context.teamId,
      channelId: context.channelId,
      userId: context.userId,
      threadTs: context.threadTs,
    });

    console.log(`[handleMessage] Agent session ID: ${agentSessionId || 'new session'}`);

    // Show initial message
    const thinkingMessage = await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: '⏳ _Processing your request..._',
    });

    // Start progress indicator (updates every 5s with honest status)
    const progressIndicator = new ProgressIndicator(
      client,
      channelId,
      thinkingMessage.ts!
    );
    progressIndicator.start();

    // Set up streaming updater (used once we get content)
    const updater = new StreamingUpdater(
      client,
      channelId,
      thinkingMessage.ts!,
      3000 // Update every 3 seconds
    );

    // Stream response from Claude Agent SDK with timeout protection
    let newSessionId = agentSessionId;
    let retryWithoutSession = false;
    let hasContent = false;

    try {
      // Create timeout promise
      const timeoutMs = config.app.agentTimeoutSeconds * 1000;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Agent query timeout')), timeoutMs);
      });

      // Race between agent query and timeout
      const processStream = (async () => {
        let chunkCount = 0;
        for await (const chunk of queryClaudeAgentStream(promptWithContext, agentSessionId)) {
          if (chunk.type === 'content' && chunk.text) {
            chunkCount++;
            console.log(`[handleMessage] Received chunk ${chunkCount}: ${chunk.text.length} chars`);
            
            // Stop progress indicator on first content
            if (!hasContent) {
              progressIndicator.stop();
              hasContent = true;
            }
            
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
            const elapsed = progressIndicator.getElapsedSeconds();
            console.log(`[handleMessage] Stream complete - ${chunkCount} total chunks, ${stats.updateCount} updates, ${stats.contentLength} chars, ${elapsed}s elapsed`);
          }
        }
      })();

      await Promise.race([processStream, timeoutPromise]);
    } catch (error: any) {
      progressIndicator.stop(); // Always stop progress indicator on error
      
      // Check if it's a timeout
      if (error.message?.includes('timeout')) {
        throw new Error(`Query timed out after ${config.app.agentTimeoutSeconds} seconds. Please try a simpler question or break it into smaller parts.`);
      }
      
      // Check if it's a "session not found" error
      if (error.message?.includes('Session not found:')) {
        console.log(`[handleMessage] Session ${agentSessionId} not found, starting new session`);
        retryWithoutSession = true;
        progressIndicator.start(); // Restart for retry
      } else {
        throw error; // Re-throw if it's a different error
      }
    }

    // Retry without session ID if the old session was missing
    if (retryWithoutSession) {
      await sessionManager.deleteSession(sessionKey);
      console.log(`[handleMessage] Retrying without session ID`);
      
      try {
        for await (const chunk of queryClaudeAgentStream(promptWithContext, undefined)) {
          if (chunk.type === 'content' && chunk.text) {
            if (!hasContent) {
              progressIndicator.stop();
              hasContent = true;
            }
            await updater.addContent(chunk.text);
          }

          if (chunk.type === 'session' && chunk.sessionId) {
            newSessionId = chunk.sessionId;
          }

          if (chunk.type === 'complete') {
            await updater.finalize();
            const stats = updater.getStats();
            const elapsed = progressIndicator.getElapsedSeconds();
            console.log(`[handleMessage] Stream complete (new session) - ${stats.updateCount} updates, ${stats.contentLength} chars, ${elapsed}s elapsed`);
          }
        }
      } finally {
        progressIndicator.stop(); // Ensure we stop on retry too
      }
    }
    
    // Ensure progress indicator is stopped
    progressIndicator.stop();

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
