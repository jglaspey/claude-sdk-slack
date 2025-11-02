# Slack Claude Bot

Interactive Slack bot powered by Claude Agent SDK with conversation memory and session management.

## Features

- Responds to `@mentions` in Slack channels
- Responds to direct messages
- Maintains conversation context within threads
- Persistent session storage (survives restarts)
- Automatic cleanup of inactive sessions
- Health check endpoint for monitoring

## Current Limitations

**Note:** All Agent SDK tools are currently disabled for stability. The bot performs text-based reasoning only and cannot:
- Read files or URLs
- Execute code
- Search the web
- Use sub-agents

See [docs/02_AGENT_SDK_ROADMAP.md](./docs/02_AGENT_SDK_ROADMAP.md) for planned feature additions.

## Architecture

- **Slack Integration**: Uses `@slack/bolt` with webhook mode
- **AI Integration**: Claude Agent SDK with session persistence
- **Session Storage**: SQLite database for mapping Slack threads to Agent SDK sessions
- **Deployment**: Docker on Railway with persistent volumes

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

### Session Scope

**Direct Messages:**
- One continuous session per user (across all DM messages)
- Session key: `{teamId}-{userId}-dm`
- Context persists across the entire DM conversation
- Use `/claude-reset` to start fresh (when implemented)

**Channel Threads:**
- One session per thread (isolated conversations)
- Session key: `{teamId}-{channelId}-{threadTs}`
- Each thread maintains separate context
- Top-level @mentions create new sessions

**Example:**
```
DM with @bot:
  User: "Explain React"
  [2 hours later]
  User: "Give me examples"  ← Remembers React context

Channel #dev, Thread A:
  User1: "@bot explain Python"
  User2: "@bot show syntax"  ← Remembers Python context
  
Channel #dev, Thread B:
  User3: "@bot explain Rust"  ← NEW session, no Python context
```

### Persistence

- Session metadata stored in SQLite database (`/data/sessions.db`)
- Agent SDK session files stored in `/data/.claude_sessions`
- Sessions auto-cleanup after 24 hours of inactivity (configurable)
- Survives Railway container restarts via persistent volume
- Gracefully handles missing session files after redeployments

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
