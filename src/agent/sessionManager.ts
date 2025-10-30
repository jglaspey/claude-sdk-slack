import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';
import Anthropic from '@anthropic-ai/sdk';

interface SessionMetadata {
  teamId: string;
  channelId: string;
  userId: string;
  threadTs: string;
}

interface SessionRecord {
  session_key: string;
  conversation_history: string; // JSON stringified MessageParam[]
  team_id: string;
  channel_id: string;
  user_id: string;
  thread_ts: string;
  created_at: number;
  last_active_at: number;
  message_count: number;
}

class SessionManager {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Ensure data directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Initialize database
    this.db = new Database(dbPath);
    this.initializeSchema();
    this.startCleanupJob();

    console.log(`[SessionManager] Initialized with database at ${dbPath}`);
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS slack_sessions (
        session_key TEXT PRIMARY KEY,
        conversation_history TEXT NOT NULL,
        team_id TEXT NOT NULL,
        channel_id TEXT,
        user_id TEXT NOT NULL,
        thread_ts TEXT,
        created_at INTEGER NOT NULL,
        last_active_at INTEGER NOT NULL,
        message_count INTEGER DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_last_active
        ON slack_sessions(last_active_at);
    `);
  }

  /**
   * Get existing conversation history or create new session
   */
  async getOrCreateSession(
    sessionKey: string,
    metadata: SessionMetadata
  ): Promise<Anthropic.MessageParam[]> {
    const stmt = this.db.prepare('SELECT * FROM slack_sessions WHERE session_key = ?');
    const record = stmt.get(sessionKey) as SessionRecord | undefined;

    if (record) {
      console.log(`[SessionManager] Found existing session: ${sessionKey}`);
      return JSON.parse(record.conversation_history);
    }

    // Create new session
    console.log(`[SessionManager] Creating new session: ${sessionKey}`);
    const now = Date.now();
    const insertStmt = this.db.prepare(`
      INSERT INTO slack_sessions (
        session_key, conversation_history, team_id, channel_id,
        user_id, thread_ts, created_at, last_active_at, message_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      sessionKey,
      JSON.stringify([]),
      metadata.teamId,
      metadata.channelId,
      metadata.userId,
      metadata.threadTs,
      now,
      now,
      0
    );

    return [];
  }

  /**
   * Update session with new message exchange
   */
  async updateSession(
    sessionKey: string,
    conversationHistory: Anthropic.MessageParam[]
  ): Promise<void> {
    const now = Date.now();
    const updateStmt = this.db.prepare(`
      UPDATE slack_sessions
      SET conversation_history = ?,
          last_active_at = ?,
          message_count = message_count + 1
      WHERE session_key = ?
    `);

    updateStmt.run(JSON.stringify(conversationHistory), now, sessionKey);
    console.log(`[SessionManager] Updated session: ${sessionKey}`);
  }

  /**
   * Update last activity timestamp
   */
  async updateSessionActivity(sessionKey: string): Promise<void> {
    const now = Date.now();
    const updateStmt = this.db.prepare(`
      UPDATE slack_sessions
      SET last_active_at = ?
      WHERE session_key = ?
    `);

    updateStmt.run(now, sessionKey);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionKey: string): Promise<void> {
    const deleteStmt = this.db.prepare('DELETE FROM slack_sessions WHERE session_key = ?');
    deleteStmt.run(sessionKey);
    console.log(`[SessionManager] Deleted session: ${sessionKey}`);
  }

  /**
   * Clean up inactive sessions
   */
  private async cleanupInactiveSessions(): Promise<void> {
    const cutoffTime = Date.now() - config.session.ttlHours * 60 * 60 * 1000;

    const deleteStmt = this.db.prepare(`
      DELETE FROM slack_sessions
      WHERE last_active_at < ?
    `);

    const result = deleteStmt.run(cutoffTime);
    const deletedCount = result.changes;

    if (deletedCount > 0) {
      console.log(`[SessionManager] Cleaned up ${deletedCount} inactive sessions`);
    }
  }

  /**
   * Start periodic cleanup job
   */
  private startCleanupJob(): void {
    const intervalMs = config.session.cleanupIntervalHours * 60 * 60 * 1000;

    setInterval(() => {
      console.log('[SessionManager] Running cleanup job...');
      this.cleanupInactiveSessions().catch((error) => {
        console.error('[SessionManager] Cleanup job failed:', error);
      });
    }, intervalMs);

    console.log(
      `[SessionManager] Cleanup job scheduled every ${config.session.cleanupIntervalHours} hour(s)`
    );
  }

  /**
   * Get session statistics
   */
  getStats(): { totalSessions: number; activeSessions: number } {
    const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM slack_sessions');
    const total = (totalStmt.get() as { count: number }).count;

    const cutoffTime = Date.now() - 60 * 60 * 1000; // Active in last hour
    const activeStmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM slack_sessions WHERE last_active_at > ?'
    );
    const active = (activeStmt.get(cutoffTime) as { count: number }).count;

    return { totalSessions: total, activeSessions: active };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// Singleton instance
let sessionManager: SessionManager | null = null;

export async function initializeSessionManager(): Promise<SessionManager> {
  if (sessionManager) {
    return sessionManager;
  }

  sessionManager = new SessionManager(config.session.dbPath);
  return sessionManager;
}

export function getSessionManager(): SessionManager {
  if (!sessionManager) {
    throw new Error('SessionManager not initialized. Call initializeSessionManager() first.');
  }
  return sessionManager;
}
