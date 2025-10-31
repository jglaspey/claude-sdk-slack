/**
 * Query Claude Agent SDK with a prompt
 * For Slack bot use, we use the Agent SDK in a stateless way
 */
export declare function queryClaudeAgent(prompt: string, sessionId?: string): Promise<{
    response: string;
    sessionId: string;
}>;
//# sourceMappingURL=claudeAgent.d.ts.map