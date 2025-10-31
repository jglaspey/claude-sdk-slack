import { queryClaudeAgent } from '../agent/claudeAgent.js';
import { getSessionManager } from '../agent/sessionManager.js';
/**
 * Generate a unique session key for mapping Slack threads to Claude sessions
 */
function getSessionKey(context) {
    if (context.channelId.startsWith('D')) {
        // Direct message - use user ID
        return `${context.teamId}-${context.userId}-dm`;
    }
    else {
        // Channel message - use thread timestamp
        return `${context.teamId}-${context.channelId}-${context.threadTs}`;
    }
}
/**
 * Remove bot mention from message text
 */
function cleanMessageText(text) {
    // Remove bot mention (e.g., "<@U123456789> hello" -> "hello")
    return text.replace(/<@[A-Z0-9]+>/g, '').trim();
}
/**
 * Handle incoming Slack message and query Claude Agent SDK
 */
export async function handleMessage(context) {
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
        // Query Claude Agent SDK
        const { response, sessionId: newSessionId } = await queryClaudeAgent(cleanText, agentSessionId);
        // Update session with Agent SDK session ID
        if (newSessionId && newSessionId !== agentSessionId) {
            await sessionManager.updateSessionId(sessionKey, newSessionId);
        }
        else {
            await sessionManager.updateSessionActivity(sessionKey);
        }
        // Update the thinking message with the actual response
        if (thinkingMessage.ts) {
            await client.chat.update({
                channel: channelId,
                ts: thinkingMessage.ts,
                text: response || 'I processed your request but have nothing to say.',
            });
        }
        console.log(`[handleMessage] Successfully processed message for session: ${sessionKey}`);
    }
    catch (error) {
        console.error('[handleMessage] Fatal error:', error);
        // Post error message
        await client.chat.postMessage({
            channel: channelId,
            thread_ts: threadTs,
            text: 'Sorry, I encountered an unexpected error. Please try again or start a new conversation.',
        });
    }
}
//# sourceMappingURL=messageHandler.js.map