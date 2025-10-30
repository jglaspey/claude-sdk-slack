import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config();

export const config = {
  // Slack Configuration
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN || '',
    signingSecret: process.env.SLACK_SIGNING_SECRET || '',
    appToken: process.env.SLACK_APP_TOKEN || '',
  },

  // Claude Configuration
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },

  // Application Configuration
  app: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },

  // Session Management
  session: {
    cleanupIntervalHours: parseInt(process.env.SESSION_CLEANUP_INTERVAL_HOURS || '1', 10),
    ttlHours: parseInt(process.env.SESSION_TTL_HOURS || '24', 10),
    // Use Railway volume path if available, otherwise local data directory
    dataDir: process.env.RAILWAY_VOLUME_MOUNT_PATH
      ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, '.claude_sessions')
      : path.join(process.cwd(), 'data', '.claude_sessions'),
    dbPath: process.env.RAILWAY_VOLUME_MOUNT_PATH
      ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'sessions.db')
      : path.join(process.cwd(), 'data', 'sessions.db'),
  },
};

// Validation
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.slack.botToken) {
    errors.push('SLACK_BOT_TOKEN is required');
  }
  if (!config.slack.signingSecret) {
    errors.push('SLACK_SIGNING_SECRET is required');
  }
  if (!config.claude.apiKey) {
    errors.push('ANTHROPIC_API_KEY is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}
