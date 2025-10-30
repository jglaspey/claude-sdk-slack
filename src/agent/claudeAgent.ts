// ABOUTME: Claude Agent SDK integration using query() function
// ABOUTME: Handles agent queries, session management, and response streaming

import { query } from '@anthropic-ai/claude-agent-sdk';
import { ANTHROPIC_API_KEY } from '../config.js';

// Set the API key
process.env.ANTHROPIC_API_KEY = ANTHROPIC_API_KEY;

/**
 * Queries the Claude agent with a message and manages session state
 * @param prompt - The user's message
 * @param sessionId - Optional session ID to resume conversation
 * @returns The agent's response as a string
 */
export async function queryAgent(
  prompt: string,
  sessionId?: string
): Promise<string> {
  try {
    const options: any = {
      model: 'claude-sonnet-4-5',
      maxTurns: 10, // Prevent infinite loops
      permissionMode: 'default',
      cwd: '/tmp', // Working directory for the agent
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: 'You are a helpful Slack assistant. Keep responses concise (max 3-5 sentences unless asked for detail). Use markdown for formatting. Be friendly and professional.'
      },
      // Allowed tools for Slack bot (safe subset)
      allowedTools: [
        'Read',
        'WebSearch',
        'WebFetch',
        'Bash',
        'Grep',
        'Glob'
      ],
      // Resume session if provided
      ...(sessionId && { resume: sessionId })
    };

    console.log(`🤖 Querying Claude agent with prompt: "${prompt.substring(0, 50)}..."`);
    if (sessionId) {
      console.log(`📎 Resuming session: ${sessionId}`);
    }

    const response = query({
      prompt,
      options
    });

    let fullResponse = '';
    let currentSessionId = sessionId;

    // Stream and collect messages
    for await (const message of response) {
      console.log(`📩 Received message type: ${message.type}`);

      // Capture session ID from init message
      if (message.type === 'system' && (message as any).subtype === 'init') {
        currentSessionId = (message as any).session_id;
        console.log(`🆔 Session ID: ${currentSessionId}`);
      }

      // Collect assistant messages
      if (message.type === 'assistant') {
        const content = (message as any).content;
        if (content && Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text' && block.text) {
              fullResponse += block.text;
            }
          }
        }
      }

      // Log tool usage
      if (message.type === 'assistant') {
        const content = (message as any).content;
        if (content) {
          for (const block of content) {
            if (block.type === 'tool_use') {
              console.log(`🔧 Tool used: ${block.name}`);
            }
          }
        }
      }

      // Log costs
      if (message.type === 'assistant') {
        const usage = (message as any).usage;
        if (usage) {
          const cost = calculateCost(usage);
          console.log(`💰 Cost for this turn: $${cost.toFixed(6)}`);
        }
      }
    }

    // Save session ID for future use
    if (currentSessionId && !sessionId) {
      // This was a new session, we need to associate it with the user
      // Note: We'll need to pass userId from the message handler
      console.log(`💾 New session created: ${currentSessionId}`);
    }

    return fullResponse.trim() || 'I processed your request but have no response.';

  } catch (error) {
    console.error('Error querying Claude agent:', error);
    throw new Error('Failed to get response from Claude agent');
  }
}

/**
 * Calculates approximate cost from usage information
 * @param usage - Usage object from Claude agent message
 * @returns Estimated cost in USD
 */
function calculateCost(usage: any): number {
  // Claude Sonnet 4.5 pricing (approximate, update with actual pricing)
  const INPUT_COST_PER_1K = 0.003;  // $3 per million tokens
  const OUTPUT_COST_PER_1K = 0.015; // $15 per million tokens

  const inputCost = (usage.input_tokens / 1000) * INPUT_COST_PER_1K;
  const outputCost = (usage.output_tokens / 1000) * OUTPUT_COST_PER_1K;

  return inputCost + outputCost;
}
