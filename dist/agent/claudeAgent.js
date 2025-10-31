import { config } from '../config.js';
/**
 * Query Claude Agent SDK with a prompt
 * For Slack bot use, we use the Agent SDK in a stateless way
 */
export async function queryClaudeAgent(prompt, sessionId) {
    console.log(`[queryClaudeAgent] Sending prompt to Claude Agent SDK`);
    console.log(`[queryClaudeAgent] Session ID: ${sessionId || 'new session'}`);
    try {
        // Dynamic import for ES module compatibility
        const { query } = await import('@anthropic-ai/claude-agent-sdk');
        // Configure Agent SDK options
        const options = {
            // Use session resumption if we have a session ID
            resume: sessionId,
            // Bypass permissions for automated Slack bot
            permissionMode: 'bypassPermissions',
            // Explicitly set Node.js as the runtime
            executable: 'node',
            // Use Claude Code system prompt for best Slack bot behavior
            systemPrompt: {
                type: 'preset',
                preset: 'claude_code',
                append: 'You are responding in Slack. Keep responses concise and well-formatted for Slack messages. Use markdown formatting when appropriate.',
            },
            // Don't load any filesystem settings - we're in the cloud
            settingSources: [],
            // Set working directory to session data dir
            cwd: config.session.dataDir,
            // Don't set env - let SDK use process.env by default
            // Disable all file system tools since we're running as a service
            disallowedTools: [
                'Read',
                'Write',
                'Edit',
                'Glob',
                'Grep',
                'Bash',
                'BashOutput',
                'KillShell',
                'NotebookEdit',
                'Task',
            ],
        };
        // Query the Agent SDK
        const result = query({
            prompt,
            options,
        });
        // Collect the response
        let fullResponse = '';
        let newSessionId = sessionId || '';
        for await (const message of result) {
            // Track session ID
            if (message.session_id) {
                newSessionId = message.session_id;
            }
            // Collect assistant messages
            if (message.type === 'assistant') {
                // Extract text content from assistant message
                const textContent = message.message.content.find((block) => block.type === 'text');
                if (textContent && 'text' in textContent) {
                    fullResponse += textContent.text;
                }
            }
            // Handle result message
            if (message.type === 'result') {
                console.log(`[queryClaudeAgent] Query completed`);
                console.log(`[queryClaudeAgent] Session: ${newSessionId}`);
                console.log(`[queryClaudeAgent] Cost: $${message.total_cost_usd}`);
                console.log(`[queryClaudeAgent] Turns: ${message.num_turns}`);
            }
        }
        if (!fullResponse) {
            console.warn('[queryClaudeAgent] No response text received');
            fullResponse = 'I processed your request but have nothing to say.';
        }
        console.log(`[queryClaudeAgent] Response length: ${fullResponse.length} chars`);
        console.log(`[queryClaudeAgent] Session ID: ${newSessionId}`);
        return { response: fullResponse, sessionId: newSessionId };
    }
    catch (error) {
        console.error('[queryClaudeAgent] Error querying Claude Agent SDK:', error);
        throw new Error(`Failed to query Claude: ${error.message}`);
    }
}
//# sourceMappingURL=claudeAgent.js.map