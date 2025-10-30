// ABOUTME: Session manager for mapping Slack users to Claude agent sessions
// ABOUTME: Stores session IDs in memory (will be replaced with database in production)

// In-memory session storage
// TODO: Replace with database (PostgreSQL via Railway) for production
const sessionStore = new Map<string, string>();

/**
 * Gets existing session ID for a user or creates a new one
 * @param userId - Slack user ID
 * @returns Session ID for the Claude agent
 */
export async function getOrCreateSession(userId: string): Promise<string | undefined> {
  const existingSession = sessionStore.get(userId);

  if (existingSession) {
    console.log(`♻️  Using existing session ${existingSession} for user ${userId}`);
    return existingSession;
  }

  // No existing session - will be created on first query
  console.log(`🆕 New session will be created for user ${userId}`);
  return undefined;
}

/**
 * Stores a session ID for a user
 * @param userId - Slack user ID
 * @param sessionId - Claude agent session ID
 */
export function saveSession(userId: string, sessionId: string): void {
  sessionStore.set(userId, sessionId);
  console.log(`💾 Saved session ${sessionId} for user ${userId}`);
}

/**
 * Deletes a session for a user
 * @param userId - Slack user ID
 */
export function deleteSession(userId: string): void {
  sessionStore.delete(userId);
  console.log(`🗑️  Deleted session for user ${userId}`);
}

/**
 * Gets all active sessions
 * @returns Map of user IDs to session IDs
 */
export function getAllSessions(): Map<string, string> {
  return new Map(sessionStore);
}
