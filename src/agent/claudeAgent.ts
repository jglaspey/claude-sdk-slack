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
 * Query Claude Agent SDK with a prompt and stream the response
 * Returns an async generator that yields text chunks as they arrive
 */
export async function* queryClaudeAgentStream(
  prompt: string,
  sessionId?: string
): AsyncGenerator<{ type: 'content' | 'session' | 'complete'; text?: string; sessionId?: string; stats?: any }> {
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
    
    // CRITICAL: Set CLAUDE_SESSION_DIR environment variable
    // The Claude Code CLI uses this to determine where to store sessions
    process.env.CLAUDE_SESSION_DIR = sessionsDir;
    console.log(`[queryClaudeAgent] Set CLAUDE_SESSION_DIR=${sessionsDir}`);
    
    // Debug: Check symlink and sessions directory
    try {
      // Check if symlink exists
      const symlinkPath = '/home/appuser/.claude/sessions';
      try {
        const linkTarget = fs.readlinkSync(symlinkPath);
        console.log(`[queryClaudeAgent] Symlink exists: ${symlinkPath} -> ${linkTarget}`);
      } catch (e) {
        console.log(`[queryClaudeAgent] Symlink does NOT exist at ${symlinkPath}`);
      }
      
      // Check what's in sessions directory
      const files = fs.readdirSync(sessionsDir);
      console.log(`[queryClaudeAgent] Sessions directory contains ${files.length} items:`, files.slice(0, 10));
      if (sessionId) {
        const sessionExists = files.some(f => f.includes(sessionId));
        console.log(`[queryClaudeAgent] Session ${sessionId} file exists: ${sessionExists}`);
      }
      
      // Also check home directory's .claude folder
      const homeClaudePath = '/home/appuser/.claude';
      if (fs.existsSync(homeClaudePath)) {
        const homeFiles = fs.readdirSync(homeClaudePath);
        console.log(`[queryClaudeAgent] ~/.claude directory contains:`, homeFiles);
        
        // If sessions subdirectory exists, check it
        const homeSessionsPath = `${homeClaudePath}/sessions`;
        if (fs.existsSync(homeSessionsPath)) {
          const homeSessionFiles = fs.readdirSync(homeSessionsPath);
          console.log(`[queryClaudeAgent] ~/.claude/sessions contains ${homeSessionFiles.length} items:`, homeSessionFiles.slice(0, 10));
        }
      } else {
        console.log(`[queryClaudeAgent] ~/.claude directory does NOT exist`);
      }
    } catch (err) {
      console.error('[queryClaudeAgent] Error reading sessions directory:', err);
    }
    
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
      // Capture CLI stdout and stderr to see all output
      stdout: (data: string) => {
        console.log('[claude-cli stdout]', data.trim());
      },
      stderr: (data: string) => {
        console.error('[claude-cli stderr]', data.trim());
      },
      // Use Claude Code system prompt for best Slack bot behavior
      systemPrompt: {
        type: 'preset' as const,
        preset: 'claude_code' as const,
        append: `You are responding in Slack. Keep responses concise and well-formatted for Slack messages.

CRITICAL - Slack Formatting Rules (NOT standard markdown):
- Use *text* for bold (single asterisk, NOT **)
- Use _text_ for italic (underscore)
- Use \`code\` for inline code
- Use \`\`\`code block\`\`\` for multi-line code
- NEVER use # or ## or ### for headers - Slack doesn't support them
- For section headers, use *Bold Text:* on its own line
- For lists, use • or 1. 2. 3. (plain text, not markdown syntax)
- Use > for quotes
- Use --- for horizontal rules

Example of good Slack formatting:
*Section Title*
Here's the content...

*Another Section*
• First point
• Second point`,
      },
      // Set working directory to /app (CLI needs to run from a normal directory)
      cwd: '/app',
      // Preserve full environment and ensure API key is set
      env: {
        ...process.env,
        // Ensure ANTHROPIC_API_KEY is passed to CLI
        ANTHROPIC_API_KEY: config.claude.apiKey,
        // Explicitly pass CLAUDE_SESSION_DIR to child process
        CLAUDE_SESSION_DIR: sessionsDir,
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
      env: { 
        PATH: (options.env as any).PATH,
        ANTHROPIC_API_KEY: options.env.ANTHROPIC_API_KEY ? '***' : 'missing'
      }
    }, null, 2));

    // Query the Agent SDK
    const result = query({
      prompt,
      options,
    });

    // Stream the response
    let newSessionId = sessionId || '';
    let hasContent = false;

    for await (const message of result) {
      // Track session ID
      if (message.session_id) {
        newSessionId = message.session_id;
        yield { type: 'session', sessionId: newSessionId };
      }

      // Stream assistant messages as they arrive
      if (message.type === 'assistant') {
        // Extract text content from assistant message
        const textContent = message.message.content.find(
          (block: any) => block.type === 'text'
        );
        if (textContent && 'text' in textContent) {
          hasContent = true;
          yield { type: 'content', text: textContent.text };
        }
      }

      // Handle result message
      if (message.type === 'result') {
        console.log(`[queryClaudeAgent] Query completed`);
        console.log(`[queryClaudeAgent] Session: ${newSessionId}`);
        console.log(`[queryClaudeAgent] Cost: $${message.total_cost_usd}`);
        console.log(`[queryClaudeAgent] Turns: ${message.num_turns}`);
        
        yield {
          type: 'complete',
          sessionId: newSessionId,
          stats: {
            cost: message.total_cost_usd,
            turns: message.num_turns,
          },
        };
      }
    }

    if (!hasContent) {
      console.warn('[queryClaudeAgent] No response text received');
      yield { type: 'content', text: 'I processed your request but have nothing to say.' };
    }
  } catch (error: any) {
    console.error('[queryClaudeAgent] Error querying Claude Agent SDK:', error);
    
    // Check if this is a session not found error and include that info
    const errorMessage = error.message || '';
    const isSessionError = errorMessage.includes('No conversation found') || 
                          (errorMessage.includes('exited with code 1') && sessionId);
    
    if (isSessionError && sessionId) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    throw new Error(`Failed to query Claude: ${error.message}`);
  }
}

/**
 * Query Claude Agent SDK with a prompt (non-streaming version for backwards compatibility)
 */
export async function queryClaudeAgent(
  prompt: string,
  sessionId?: string
): Promise<{ response: string; sessionId: string }> {
  let fullResponse = '';
  let finalSessionId = sessionId || '';

  for await (const chunk of queryClaudeAgentStream(prompt, sessionId)) {
    if (chunk.type === 'content' && chunk.text) {
      fullResponse += chunk.text;
    }
    if (chunk.type === 'session' && chunk.sessionId) {
      finalSessionId = chunk.sessionId;
    }
    if (chunk.type === 'complete' && chunk.sessionId) {
      finalSessionId = chunk.sessionId;
    }
  }

  return { response: fullResponse, sessionId: finalSessionId };
}
