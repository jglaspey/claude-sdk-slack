# Deployment Guide

## Quick Start

Your Slack bot is ready to deploy! Here's what to do next:

### 1. Install Dependencies Locally (Optional - for testing)

```bash
npm install
```

### 2. Configure Environment Variables in Railway

In your Railway dashboard, add these environment variables:

```bash
SLACK_BOT_TOKEN=xoxb-your-actual-token
SLACK_SIGNING_SECRET=your-actual-secret
ANTHROPIC_API_KEY=sk-ant-your-actual-key
PORT=3000
NODE_ENV=production
SESSION_CLEANUP_INTERVAL_HOURS=1
SESSION_TTL_HOURS=24
```

### 3. Configure Railway Persistent Volume

In Railway dashboard:
1. Go to your service settings
2. Click "Volumes" tab
3. Add new volume:
   - Mount path: `/data`
   - Size: 5GB (start small, can scale later)

### 4. Deploy to Railway

```bash
# Commit and push to GitHub
git add .
git commit -m "Initial Slack Claude bot implementation"
git push origin blank-branch

# Railway will automatically deploy when you push
```

### 5. Configure Slack Webhook

Once Railway deploys:
1. Copy your Railway app URL (e.g., `https://your-app.railway.app`)
2. Go to your Slack App settings
3. Navigate to "Event Subscriptions"
4. Enable events
5. Set Request URL to: `https://your-app.railway.app/slack/events`
6. Subscribe to bot events:
   - `app_mention`
   - `message.im`

### 6. Test Your Bot

In Slack:
- Mention your bot: `@your-bot hello!`
- Send a DM to your bot
- Start a conversation in a thread

## Project Architecture

```
slack-claude-bot/
├── src/
│   ├── index.ts              # Entry point, starts Express & Slack app
│   ├── config.ts             # Environment config & validation
│   ├── slack/
│   │   ├── slackApp.ts       # Slack Bolt app initialization
│   │   └── messageHandler.ts # Message processing & Claude integration
│   └── agent/
│       ├── claudeAgent.ts    # Claude API wrapper
│       └── sessionManager.ts # SQLite session storage
├── package.json              # Dependencies & scripts
├── tsconfig.json             # TypeScript configuration
├── railway.toml              # Railway deployment config
└── README.md                 # Documentation
```

## How It Works

1. **Slack Event Received**: User mentions bot or sends DM
2. **Session Lookup**: Find or create conversation session for this thread
3. **Claude Query**: Send message to Claude with conversation history
4. **Response Posted**: Update Slack with Claude's response
5. **History Saved**: Store conversation in SQLite database

## Session Management

- Each Slack thread = separate Claude conversation
- Sessions stored in `/data/sessions.db` (persistent volume)
- Auto-cleanup after 24 hours of inactivity
- Survives Railway container restarts

## Monitoring

Health check endpoint: `https://your-app.railway.app/health`

Check Railway logs for:
- Session creation: `[SessionManager] Creating new session: ...`
- Message processing: `[handleMessage] Processing message for session: ...`
- Claude queries: `[queryClaudeAgent] Sending prompt to Claude...`
- Errors: Look for `[ERROR]` or stack traces

## Troubleshooting

### Bot doesn't respond in Slack

1. Check Railway logs for errors
2. Verify Slack Event Subscriptions webhook is verified (green checkmark)
3. Test health endpoint: `curl https://your-app.railway.app/health`
4. Confirm environment variables are set in Railway

### "Session not found" errors

- Normal after Railway restarts if session was old
- Bot will automatically create new session
- Check `/data` volume is mounted correctly

### TypeScript build errors

```bash
# Run locally to check
npm run build
npm run typecheck
```

### Rate limiting

Claude API has rate limits. Monitor usage at:
https://console.anthropic.com/

## Next Steps

### Optional Enhancements

1. **Rich Formatting**: Add Slack Block Kit for better message formatting
2. **Slash Commands**: Add `/claude help` or `/claude reset` commands
3. **Streaming Updates**: Update message progressively as Claude responds
4. **User Preferences**: Store per-user settings
5. **Analytics**: Track usage metrics and conversation stats
6. **Multi-workspace**: Support multiple Slack workspaces

### Production Hardening

1. Add comprehensive error logging
2. Set up Railway alerts for errors
3. Monitor disk usage (session database growth)
4. Add rate limiting protection
5. Implement backup strategy for session database

## Support

- Check Railway logs first
- Review Slack app event logs
- Test health endpoint
- Verify all environment variables are set

## Files Modified from Original Requirements

The implementation differs slightly from the requirements document:

- **No Agent SDK**: Using standard Anthropic SDK instead (Agent SDK is for CLI/desktop use)
- **Conversation tracking**: Manually tracking conversation history in SQLite
- **Simpler architecture**: Direct Claude API integration without complex session files

This approach is more suitable for a web service and achieves the same goals with simpler, more maintainable code.
