// ABOUTME: Configuration file that loads and validates environment variables
// ABOUTME: Centralizes all config values used across the application

export const PORT = process.env.PORT || 3000;
export const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';
export const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// Validate required environment variables
if (!SLACK_BOT_TOKEN) {
  throw new Error('SLACK_BOT_TOKEN is required');
}

if (!SLACK_SIGNING_SECRET) {
  throw new Error('SLACK_SIGNING_SECRET is required');
}

if (!ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is required');
}
