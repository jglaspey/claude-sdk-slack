interface SessionMetadata {
    teamId: string;
    channelId: string;
    userId: string;
    threadTs: string;
}
declare class SessionManager {
    private db;
    private static readonly SCHEMA_VERSION;
    constructor(dbPath: string);
    private initializeSchema;
    private migrateSchema;
    /**
     * Get existing Agent SDK session ID or return undefined for new session
     */
    getOrCreateSession(sessionKey: string, metadata: SessionMetadata): Promise<string | undefined>;
    /**
     * Update session with Agent SDK session ID
     */
    updateSessionId(sessionKey: string, agentSessionId: string): Promise<void>;
    /**
     * Update last activity timestamp
     */
    updateSessionActivity(sessionKey: string): Promise<void>;
    /**
     * Delete a session
     */
    deleteSession(sessionKey: string): Promise<void>;
    /**
     * Clean up inactive sessions
     */
    private cleanupInactiveSessions;
    /**
     * Start periodic cleanup job
     */
    private startCleanupJob;
    /**
     * Get session statistics
     */
    getStats(): {
        totalSessions: number;
        activeSessions: number;
    };
    /**
     * Close database connection
     */
    close(): void;
}
export declare function initializeSessionManager(): Promise<SessionManager>;
export declare function getSessionManager(): SessionManager;
export {};
//# sourceMappingURL=sessionManager.d.ts.map