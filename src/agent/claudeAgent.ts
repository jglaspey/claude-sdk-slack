import { config } from '../config.js';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);

/**
 * Get sessions directory, creating it if needed
 * Handles Railway volume mounting correctly
 */
function getSessionsDir(): string {
  // Use Railway volume if mounted, otherwise use /app
  const mount = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  const sessionsPath = mount
    ? path.join(mount, '.claude_sessions')
    : path.join('/app', '.claude_sessions');
  
  // Create directory if it doesn't exist
  fs.mkdirSync(sessionsPath, { recursive: true });
  console.log(`[Sessions] Using directory: ${sessionsPath}`);
  
  return sessionsPath;
}

/**
 * Query Claude Agent SDK with a prompt
 * For Slack bot use, we use the Agent SDK in a stateless way
 */
export async function queryClaudeAgent(
  prompt: string,
  sessionId?: string
): Promise<{ response: string; sessionId: string }> {
  console.log(`[queryClaudeAgent] Sending prompt to Claude Agent SDK`);
  console.log(`[queryClaudeAgent] Session ID: ${sessionId || 'new session'}`);

  try {
    // Dynamic import for ES module compatibility
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    
    // Get absolute path to CLI JS file (bypasses shebang issues)
    const cliJs = require.resolve('@anthropic-ai/claude-code/cli.js');
    console.log(`[queryClaudeAgent] CLI path: ${cliJs}`);

    // Get and create sessions directory
    const sessionsDir = getSessionsDir();
    
    // Configure Agent SDK options
    const options = {
      // Use session resumption if we have a session ID
      resume: sessionId,
      // Bypass permissions for automated Slack bot
      permissionMode: 'bypassPermissions' as const,
      // Use node executable directly (bypasses shebang PATH issues)
      executable: 'node' as const,
      // Point to the CLI JS file (not a shell wrapper)
      pathToClaudeCodeExecutable: cliJs,
      // Use Claude Code system prompt for best Slack bot behavior
      systemPrompt: {
        type: 'preset' as const,
        preset: 'claude_code' as const,
        append: 'You are responding in Slack. Keep responses concise and well-formatted for Slack messages. Use markdown formatting when appropriate.',
      },
      // Don't load any filesystem settings - we're in the cloud
      settingSources: [],
      // Set working directory to sessions dir (MUST exist!)
      cwd: sessionsDir,
      // Preserve full environment (includes PATH)
      env: {
        ...process.env,
      },
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

    // Debug: Log the options being passed
    console.log('[queryClaudeAgent] Options:', JSON.stringify({
      executable: options.executable,
      pathToClaudeCodeExecutable: options.pathToClaudeCodeExecutable,
      cwd: options.cwd,
      cwdExists: fs.existsSync(options.cwd),
      env: { PATH: options.env?.PATH }
    }, null, 2));

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
        const textContent = message.message.content.find(
          (block: any) => block.type === 'text'
        );
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
  } catch (error: any) {
    console.error('[queryClaudeAgent] Error querying Claude Agent SDK:', error);
    throw new Error(`Failed to query Claude: ${error.message}`);
  }
}
