// ABOUTME: Message handler that routes Slack messages to Claude agent
// ABOUTME: Manages session mapping between Slack users and Claude agent sessions

import { getOrCreateSession } from '../agent/sessionManager.js';
import { queryAgent } from '../agent/claudeAgent.js';

/**
 * Handles incoming messages from Slack and routes them to Claude agent
 * @param message - The message text from Slack
 * @param userId - Slack user ID
 * @param channelId - Slack channel ID
 * @returns The agent's response as a string
 */
export async function handleMessage(
  message: string,
  userId: string,
  channelId: string
): Promise<string> {
  try {
    // Get or create a session for this user
    const sessionId = await getOrCreateSession(userId);

    console.log(`🔍 Processing message for user ${userId}, session ${sessionId}`);

    // Query the Claude agent
    const response = await queryAgent(message, sessionId);

    return response;
  } catch (error) {
    console.error('Error in handleMessage:', error);
    throw error;
  }
}
