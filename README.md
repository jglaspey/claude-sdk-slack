# Slack Claude Bot

Interactive Slack bot powered by Claude AI with conversation memory and session management.

## Features

- Responds to `@mentions` in Slack channels
- Responds to direct messages
- Maintains conversation context within threads
- Persistent session storage (survives restarts)
- Automatic cleanup of inactive sessions
- Health check endpoint for monitoring

## Architecture

- **Slack Integration**: Uses `@slack/bolt` with webhook mode
- **AI Integration**: Claude API with conversation history tracking
- **Session Storage**: SQLite database for mapping Slack threads to conversations
- **Deployment**: Railway with persistent volumes

## Setup

### Prerequisites

- Node.js 20.x or higher
- Slack workspace with bot app configured
- Anthropic API key
- Railway account (for deployment)

### Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret

# Claude Configuration
ANTHROPIC_API_KEY=sk-ant-your-api-key

# Application Configuration
PORT=3000
NODE_ENV=production

# Session Management
SESSION_CLEANUP_INTERVAL_HOURS=1
SESSION_TTL_HOURS=24
```

### Local Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run locally
npm run dev
```

### Railway Deployment

1. Push code to GitHub
2. Create new Railway project
3. Connect GitHub repository
4. Add persistent volume:
   - Mount path: `/data`
   - Size: 5GB (adjust as needed)
5. Configure environment variables in Railway dashboard
6. Deploy (automatic on git push)
7. Copy Railway public URL
8. Configure Slack app webhook URL: `https://your-app.railway.app/slack/events`

## Slack App Configuration

Your Slack app needs these configurations:

### OAuth & Permissions

Required bot token scopes:
- `app_mentions:read` - Read messages mentioning the bot
- `chat:write` - Send messages
- `channels:history` - Read channel messages
- `groups:history` - Read private channel messages
- `im:history` - Read DM history
- `im:write` - Send DMs

### Event Subscriptions

Enable events and set Request URL to: `https://your-app.railway.app/slack/events`

Subscribe to bot events:
- `app_mention` - When bot is mentioned
- `message.im` - Direct messages to bot

## Session Management

- Each Slack thread maintains its own conversation history
- Sessions auto-cleanup after 24 hours of inactivity (configurable)
- Conversation history stored in SQLite database
- Survives Railway container restarts via persistent volume

## Project Structure

```
/slack-claude-bot
├── src/
│   ├── index.ts              # Main entry point
│   ├── config.ts             # Configuration management
│   ├── slack/
│   │   ├── slackApp.ts       # Slack Bolt app setup
│   │   └── messageHandler.ts # Message processing logic
│   └── agent/
│       ├── claudeAgent.ts    # Claude API integration
│       └── sessionManager.ts # Session storage & cleanup
├── package.json
├── tsconfig.json
├── railway.toml              # Railway deployment config
└── .env.example
```

## Monitoring

Health check endpoint: `GET /health`

Returns:
```json
{
  "status": "ok",
  "timestamp": "2025-10-30T12:34:56.789Z",
  "uptime": 12345
}
```

## Troubleshooting

### Bot not responding

1. Check Railway logs for errors
2. Verify environment variables are set
3. Confirm Slack webhook URL is correct
4. Check Slack app has required permissions

### Session persistence issues

1. Verify Railway volume is mounted at `/data`
2. Check database file exists: `/data/sessions.db`
3. Review session manager logs

### API rate limits

Claude API has rate limits. If hitting limits:
- Monitor usage in Anthropic dashboard
- Consider implementing queuing
- Add rate limit error handling

## License

MIT
