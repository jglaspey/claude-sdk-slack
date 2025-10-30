import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';

const client = new Anthropic({
  apiKey: config.claude.apiKey,
});

/**
 * Query Claude with a message
 * Note: We're using the standard Anthropic SDK, not the Agent SDK
 * The Agent SDK appears to be for CLI/desktop use cases with file system access
 * For a Slack bot, we'll use the standard API with manual conversation tracking
 */
export async function queryClaudeAgent(
  prompt: string,
  conversationHistory: Anthropic.MessageParam[] = []
): Promise<string> {
  console.log(`[queryClaudeAgent] Sending prompt to Claude (history length: ${conversationHistory.length})`);

  try {
    // Build messages array with conversation history
    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory,
      {
        role: 'user',
        content: prompt,
      },
    ];

    // Query Claude
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages,
      system: `You are a helpful AI assistant integrated into Slack. You can answer questions, help with tasks, and have natural conversations. Keep your responses concise and well-formatted for Slack messages.`,
    });

    // Extract text response
    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in Claude response');
    }

    console.log(`[queryClaudeAgent] Received response (${textContent.text.length} chars)`);
    return textContent.text;
  } catch (error: any) {
    console.error('[queryClaudeAgent] Error querying Claude:', error);
    throw new Error(`Failed to query Claude: ${error.message}`);
  }
}
