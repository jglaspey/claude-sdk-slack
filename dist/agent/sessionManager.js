import DatabaseConstructor from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config.js';
class SessionManager {
    constructor(dbPath) {
        // Ensure data directory exists
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        // Initialize database
        this.db = new DatabaseConstructor(dbPath);
        this.initializeSchema();
        this.startCleanupJob();
        console.log(`[SessionManager] Initialized with database at ${dbPath}`);
    }
    initializeSchema() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS slack_sessions (
        session_key TEXT PRIMARY KEY,
        agent_session_id TEXT,
        team_id TEXT NOT NULL,
        channel_id TEXT,
        user_id TEXT NOT NULL,
        thread_ts TEXT,
        created_at INTEGER NOT NULL,
        last_active_at INTEGER NOT NULL,
        message_count INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_last_active
        ON slack_sessions(last_active_at);
    `);
        // Migrate existing tables if needed
        this.migrateSchema();
    }
    migrateSchema() {
        // Check if we have the old schema with conversation_history column
        const tableInfo = this.db.pragma('table_info(slack_sessions)');
        console.log(`[SessionManager] SCHEMA CHECK v${SessionManager.SCHEMA_VERSION}: found ${tableInfo.length} columns`);
        const hasConversationHistory = tableInfo.some((col) => col.name === 'conversation_history');
        const hasAgentSessionId = tableInfo.some((col) => col.name === 'agent_session_id');
        console.log(`[SessionManager] Has conversation_history (old): ${hasConversationHistory}`);
        console.log(`[SessionManager] Has agent_session_id (new): ${hasAgentSessionId}`);
        // If we have the old conversation_history column, DROP THE ENTIRE TABLE
        if (hasConversationHistory) {
            console.log('[SessionManager] >>> DETECTED OLD SCHEMA - DROPPING AND RECREATING TABLE <<<');
            this.db.exec(`DROP TABLE IF EXISTS slack_sessions;`);
            console.log('[SessionManager] >>> Old table dropped, recreating with new schema <<<');
            // Recreate with new schema
            this.db.exec(`
        CREATE TABLE slack_sessions (
          session_key TEXT PRIMARY KEY,
          agent_session_id TEXT,
          team_id TEXT NOT NULL,
          channel_id TEXT,
          user_id TEXT NOT NULL,
          thread_ts TEXT,
          created_at INTEGER NOT NULL,
          last_active_at INTEGER NOT NULL,
          message_count INTEGER DEFAULT 0
        );

        CREATE INDEX idx_last_active ON slack_sessions(last_active_at);
      `);
            console.log('[SessionManager] >>> Migration complete - fresh database created <<<');
        }
        else if (!hasAgentSessionId) {
            console.log('[SessionManager] Adding agent_session_id column');
            this.db.exec('ALTER TABLE slack_sessions ADD COLUMN agent_session_id TEXT');
            console.log('[SessionManager] Migration complete');
        }
        else {
            console.log('[SessionManager] Schema is up to date');
        }
    }
    /**
     * Get existing Agent SDK session ID or return undefined for new session
     */
    async getOrCreateSession(sessionKey, metadata) {
        const stmt = this.db.prepare('SELECT * FROM slack_sessions WHERE session_key = ?');
        const record = stmt.get(sessionKey);
        if (record && record.agent_session_id) {
            console.log(`[SessionManager] Found existing session: ${sessionKey}`);
            console.log(`[SessionManager] Agent session ID: ${record.agent_session_id}`);
            return record.agent_session_id;
        }
        // Create new session record (Agent SDK will generate session ID)
        console.log(`[SessionManager] Creating new session: ${sessionKey}`);
        const now = Date.now();
        const insertStmt = this.db.prepare(`
      INSERT INTO slack_sessions (
        session_key, agent_session_id, team_id, channel_id,
        user_id, thread_ts, created_at, last_active_at, message_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        insertStmt.run(sessionKey, null, // Will be updated after first query
        metadata.teamId, metadata.channelId, metadata.userId, metadata.threadTs, now, now, 0);
        return undefined; // New session
    }
    /**
     * Update session with Agent SDK session ID
     */
    async updateSessionId(sessionKey, agentSessionId) {
        const now = Date.now();
        const updateStmt = this.db.prepare(`
      UPDATE slack_sessions
      SET agent_session_id = ?,
          last_active_at = ?,
          message_count = message_count + 1
      WHERE session_key = ?
    `);
        updateStmt.run(agentSessionId, now, sessionKey);
        console.log(`[SessionManager] Updated session: ${sessionKey} -> ${agentSessionId}`);
    }
    /**
     * Update last activity timestamp
     */
    async updateSessionActivity(sessionKey) {
        const now = Date.now();
        const updateStmt = this.db.prepare(`
      UPDATE slack_sessions
      SET last_active_at = ?,
          message_count = message_count + 1
      WHERE session_key = ?
    `);
        updateStmt.run(now, sessionKey);
    }
    /**
     * Delete a session
     */
    async deleteSession(sessionKey) {
        const deleteStmt = this.db.prepare('DELETE FROM slack_sessions WHERE session_key = ?');
        deleteStmt.run(sessionKey);
        console.log(`[SessionManager] Deleted session: ${sessionKey}`);
    }
    /**
     * Clean up inactive sessions
     */
    async cleanupInactiveSessions() {
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
    startCleanupJob() {
        const intervalMs = config.session.cleanupIntervalHours * 60 * 60 * 1000;
        setInterval(() => {
            console.log('[SessionManager] Running cleanup job...');
            this.cleanupInactiveSessions().catch((error) => {
                console.error('[SessionManager] Cleanup job failed:', error);
            });
        }, intervalMs);
        console.log(`[SessionManager] Cleanup job scheduled every ${config.session.cleanupIntervalHours} hour(s)`);
    }
    /**
     * Get session statistics
     */
    getStats() {
        const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM slack_sessions');
        const total = totalStmt.get().count;
        const cutoffTime = Date.now() - 60 * 60 * 1000; // Active in last hour
        const activeStmt = this.db.prepare('SELECT COUNT(*) as count FROM slack_sessions WHERE last_active_at > ?');
        const active = activeStmt.get(cutoffTime).count;
        return { totalSessions: total, activeSessions: active };
    }
    /**
     * Close database connection
     */
    close() {
        this.db.close();
    }
}
SessionManager.SCHEMA_VERSION = 2; // Force rebuild v2
// Singleton instance
let sessionManager = null;
export async function initializeSessionManager() {
    if (sessionManager) {
        return sessionManager;
    }
    sessionManager = new SessionManager(config.session.dbPath);
    return sessionManager;
}
export function getSessionManager() {
    if (!sessionManager) {
        throw new Error('SessionManager not initialized. Call initializeSessionManager() first.');
    }
    return sessionManager;
}
//# sourceMappingURL=sessionManager.js.map