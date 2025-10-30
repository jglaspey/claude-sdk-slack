# Slack Bot with Claude Agent SDK - Requirements & Considerations

> Comprehensive requirements and architectural considerations for deploying an interactive Slack bot powered by the Claude Agent SDK on Railway

**Date:** October 30, 2025
**Status:** Planning Phase

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Core Requirements](#core-requirements)
3. [Technical Stack](#technical-stack)
4. [Architecture Decisions](#architecture-decisions)
5. [Session Management Strategy](#session-management-strategy)
6. [Deployment Approach](#deployment-approach)
7. [Implementation Challenges](#implementation-challenges)
8. [Key Questions to Resolve](#key-questions-to-resolve)
9. [Success Criteria](#success-criteria)
10. [Next Steps](#next-steps)

---

## Project Overview

### Goal
Build an interactive Slack bot that integrates the Claude Agent SDK, enabling natural language interactions with Claude's autonomous capabilities (web search, file operations, reasoning) directly within Slack conversations.

### Why Agent SDK vs Direct API
- **Agent SDK**: Provides autonomous tool use (WebSearch, file operations, etc.), multi-turn workflows, automatic session management
- **Direct API**: Simple request-response, no built-in tools, manual history management
- **Decision**: Agent SDK required for autonomous workflows and tool access

### Platform
Deploy on **Railway** for managed infrastructure, automatic deployments, and persistent storage.

---

## Core Requirements

### Functional Requirements

#### Slack Integration
- **Event handling**: Respond to mentions (`@bot-name`) and direct messages
- **Thread support**: Maintain conversation context within Slack threads
- **Response posting**: Post Claude's responses back to Slack threads
- **User identification**: Track which user initiated each conversation

#### Claude Integration
- **SDK integration**: Use `@anthropic-ai/claude-agent-sdk` for queries
- **Session continuity**: Resume conversations across multiple messages
- **Tool access**: Enable Claude to use WebSearch and other tools as needed
- **Permission mode**: Configure appropriate permission model for bot context

#### Conversation Management
- **Thread mapping**: Map Slack threads to Claude sessions
- **Context persistence**: Maintain conversation history across bot restarts
- **Session cleanup**: Remove old/abandoned sessions automatically
- **Error handling**: Gracefully handle session failures and start fresh

### Non-Functional Requirements

#### Performance
- **Response time**: Acknowledge Slack events within 3 seconds (Slack requirement)
- **Async processing**: Handle long-running Claude queries asynchronously
- **Concurrent sessions**: Support multiple simultaneous conversations

#### Reliability
- **Persistent storage**: Sessions survive container restarts
- **Graceful degradation**: Handle API failures without crashing
- **Health monitoring**: Expose health check endpoints for Railway

#### Scalability
- **Single instance initially**: Start with one Railway service
- **Scale consideration**: Design for future horizontal scaling if needed
- **Session isolation**: Each Slack thread is an independent session

---

## Technical Stack

### Core Dependencies

```json
{
  "@anthropic-ai/claude-agent-sdk": "latest",
  "@slack/bolt": "^3.x",
  "express": "^4.x",
  "dotenv": "^16.x",
  "better-sqlite3": "^9.x"
}
```

### Runtime
- **Language**: TypeScript (compiled to JavaScript)
- **Runtime**: Node.js 20.x
- **Package Manager**: npm

### Infrastructure
- **Hosting**: Railway
- **Build System**: Nixpacks (Railway's auto-detection)
- **Storage**: Railway Persistent Volumes
- **Secrets**: Railway Environment Variables

---

## Architecture Decisions

### 1. Docker vs Nixpacks
**Decision**: Use **Nixpacks** (no Docker)

**Rationale**:
- Railway's Nixpacks auto-detects Node.js/TypeScript
- No Docker expertise required
- Simpler deployment (just `package.json` + code)
- Session management concerns exist regardless of container build method

**What We Don't Need**:
- ❌ Dockerfile
- ❌ Docker Compose
- ❌ Container knowledge

**What We Do Need**:
- ✅ `package.json` with build/start scripts
- ✅ `tsconfig.json` for TypeScript
- ✅ Railway persistent volume configuration

### 2. Session Storage Architecture
**Decision**: Store sessions on Railway persistent volumes, organized by Slack thread

**Critical Understanding**:
The Claude Agent SDK stores sessions on the **local filesystem** by default:
```
~/.claude/sessions/
├── session-abc123/
│   ├── conversation.json
│   ├── context.json
│   └── files/
```

**Problem**: Railway containers are ephemeral - restarts lose all data

**Solution**: Configure SDK to use Railway's persistent volume
```typescript
const sessionDir = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? `${process.env.RAILWAY_VOLUME_MOUNT_PATH}/.claude_sessions`
  : './data/.claude_sessions';

process.env.CLAUDE_SESSION_DIR = sessionDir;
```

### 3. Slack Event Handling
**Decision**: Use webhook mode (not Socket Mode)

**Rationale**:
- Railway provides public URLs automatically
- No need for WebSocket connection management
- Simpler deployment model
- Better for serverless-style architectures

**Requirement**: Respond to Slack within 3 seconds
**Implementation**: Immediately acknowledge (200 OK), process Claude query async, post result in thread

---

## Session Management Strategy

### Session Organization

```
/data/                                    (Railway persistent volume)
├── .claude_sessions/
│   ├── T1234-C5678-1699123456/          (team-channel-thread_ts)
│   │   └── session-abc123/               (actual Claude session)
│   └── T1234-U9012-dm/                   (team-user for DMs)
│       └── session-def456/
└── sessions.db                           (SQLite tracking database)
```

### Session Lifecycle

#### Creation
```typescript
// Slack event arrives
const sessionKey = `${team_id}-${channel_id}-${thread_ts || 'dm'}`;

// Check if session exists for this thread
const existingSessionId = await db.getSessionId(sessionKey);

// Resume existing or create new
const query_options = existingSessionId
  ? { resume: existingSessionId }
  : { /* new session */ };
```

#### Tracking
Store metadata in SQLite:
```sql
CREATE TABLE slack_sessions (
  session_key TEXT PRIMARY KEY,        -- T1234-C5678-1699123456
  claude_session_id TEXT NOT NULL,     -- session-abc123
  team_id TEXT NOT NULL,
  channel_id TEXT,
  user_id TEXT NOT NULL,
  thread_ts TEXT,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  message_count INTEGER DEFAULT 1
);
```

#### Cleanup
- **TTL**: 24 hours of inactivity
- **Method**: Periodic cleanup job (every hour)
- **Process**: Delete session files + database records

```typescript
async function cleanupInactiveSessions() {
  const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
  const inactive = await db.getInactiveSessions(cutoff);

  for (const session of inactive) {
    await fs.rm(session.sessionPath, { recursive: true });
    await db.deleteSession(session.sessionKey);
  }
}
```

### Session Recovery
If Claude session is not found:
1. Log the error
2. Remove stale database entry
3. Start a new conversation
4. Inform user: "Starting a fresh conversation (previous session expired)"

---

## Deployment Approach

### Application Structure

```
/slack-claude-bot
├── package.json
├── tsconfig.json
├── .env.example
├── railway.toml               (optional but recommended)
├── src/
│   ├── index.ts              # Main entry point
│   ├── slack/
│   │   ├── app.ts            # Slack Bolt app setup
│   │   ├── handlers.ts       # Event handlers (mentions, DMs)
│   │   └── formatting.ts     # Slack message formatting
│   ├── claude/
│   │   ├── service.ts        # Claude SDK integration
│   │   └── session-manager.ts
│   ├── db/
│   │   └── session-store.ts  # SQLite session tracking
│   └── utils/
│       ├── logger.ts
│       └── health.ts         # Health check endpoint
└── dist/                      (generated by tsc)
```

### Build Configuration

#### package.json
```json
{
  "name": "slack-claude-bot",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

#### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### railway.toml
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 10

[[volumes]]
mountPath = "/data"
```

### Environment Variables

```bash
# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret

# Claude Configuration
ANTHROPIC_API_KEY=sk-ant-your-api-key
CLAUDE_SESSION_DIR=/data/.claude_sessions

# Application Configuration
PORT=3000
NODE_ENV=production

# Session Management
SESSION_CLEANUP_INTERVAL_HOURS=1
SESSION_TTL_HOURS=24

# Logging
LOG_LEVEL=info
```

### Railway Setup Process

1. **Create Railway project**
2. **Connect GitHub repository**
3. **Add persistent volume**
   - Mount path: `/data`
   - Size: 5GB (start small, scale as needed)
4. **Configure environment variables** (via Railway dashboard)
5. **Deploy** (automatic on git push)
6. **Copy public URL** for Slack webhook configuration
7. **Configure Slack app** with Railway URL

---

## Implementation Challenges

### Challenge 1: Slack's 3-Second Timeout

**Problem**: Slack webhooks must respond within 3 seconds, but Claude queries can take 10-60+ seconds.

**Solution**: Immediate acknowledgment + async processing
```typescript
app.event('app_mention', async ({ event, ack }) => {
  await ack(); // Respond within 3 seconds

  // Process in background
  processClaudeQuery(event).catch(console.error);
});
```

### Challenge 2: Streaming vs. Complete Messages

**Problem**: Claude SDK streams tokens, but Slack posts complete messages.

**Solution Options**:
1. **Buffer approach**: Wait for complete response, post once
2. **Update approach**: Post initial message, update as more content arrives
3. **Typing indicator**: Show bot is "typing" while processing

**Recommendation**: Start with buffer approach (simpler), add updates if needed.

### Challenge 3: Thread Context Mapping

**Problem**: Determining which Slack thread maps to which Claude session.

**Solution**: Use composite key from Slack identifiers
```typescript
function getSessionKey(event: SlackEvent): string {
  if (event.thread_ts) {
    // Message in thread
    return `${event.team_id}-${event.channel}-${event.thread_ts}`;
  } else if (event.channel.startsWith('D')) {
    // Direct message
    return `${event.team_id}-${event.user}-dm`;
  } else {
    // New thread starter
    return `${event.team_id}-${event.channel}-${event.ts}`;
  }
}
```

### Challenge 4: Permission Model

**Problem**: Claude SDK can execute code, access files, etc. What should be allowed?

**Decision Points**:
- `bypassPermissions`: Auto-approve all tool use (faster, less safe)
- `acceptEdits`: Auto-approve file edits (if bot creates files)
- `default`: Ask for permission (doesn't work for async Slack bot)

**Recommendation**: Start with `bypassPermissions` + limited `allowedTools`
```typescript
options: {
  permissionMode: 'bypassPermissions',
  allowedTools: ['WebSearch', 'Read'],  // Restrict to safe tools
}
```

### Challenge 5: Error Handling & Recovery

**Problem**: What happens when Claude fails mid-conversation?

**Scenarios**:
1. API rate limit hit
2. Session not found (after restart)
3. Network timeout
4. Invalid tool use

**Solution**: Graceful degradation
```typescript
try {
  for await (const message of query(prompt, options)) {
    // Process message
  }
} catch (error) {
  if (error.message.includes('session not found')) {
    // Start new session
    await slackClient.chat.postMessage({
      channel: event.channel,
      text: "Starting a fresh conversation (previous session expired)",
      thread_ts: event.thread_ts
    });
  } else {
    // Generic error
    await slackClient.chat.postMessage({
      channel: event.channel,
      text: "Sorry, I encountered an error. Please try again.",
      thread_ts: event.thread_ts
    });
  }
}
```

---

## Key Questions to Resolve

### Before Implementation

1. **Conversation scope**: Should each Slack thread be a separate Claude session, or should we maintain continuous context for a user across all threads?
   - **Recommendation**: Thread-scoped (cleaner isolation)

2. **Response format**: Plain text, markdown, or Slack blocks with rich formatting?
   - **Recommendation**: Start with markdown (Slack supports mrkdwn), add blocks later if needed

3. **Workspace scope**: Single workspace or multi-workspace support?
   - **Recommendation**: Start single workspace, design for multi-workspace

4. **Channel types**: Public channels, private channels, DMs, or all three?
   - **Recommendation**: Start with mentions + DMs (simpler permissions)

5. **Rate limiting**: How many concurrent conversations should one bot handle?
   - **Recommendation**: No artificial limit, rely on Railway resources

6. **Tool restrictions**: Which Claude tools should be enabled?
   - **Recommendation**: `WebSearch`, `Read` only (no file writes, no bash execution)

### During Development

7. **Logging strategy**: What should be logged for debugging?
   - Session creation/resumption
   - Tool usage
   - Errors and exceptions
   - Slack event types

8. **Monitoring**: What metrics matter?
   - Active sessions count
   - Messages per day
   - Average response time
   - Error rate

9. **Testing approach**: How to test without spamming real Slack?
   - Use Slack sandbox workspace
   - Mock Slack events for unit tests
   - Integration tests with test channel

---

## Success Criteria

### Minimum Viable Product (MVP)

- [ ] Bot responds to `@mentions` in Slack channels
- [ ] Bot responds to direct messages
- [ ] Conversations maintain context within threads
- [ ] Sessions survive Railway container restarts
- [ ] Basic error handling (doesn't crash on errors)
- [ ] Health check endpoint works

### Production Ready

- [ ] Session cleanup prevents disk space issues
- [ ] Comprehensive error handling and logging
- [ ] Response formatting looks good in Slack
- [ ] Multi-user concurrent conversations work
- [ ] Performance meets Slack's 3-second requirement
- [ ] Monitoring and alerting in place

### Nice to Have

- [ ] Streaming updates (progressive message updates)
- [ ] Rich formatting with Slack blocks
- [ ] Slash commands (e.g., `/claude help`)
- [ ] Interactive buttons for common actions
- [ ] Admin dashboard for session management
- [ ] Usage analytics and reporting

---

## Next Steps

### Phase 1: Setup & Foundation
1. Create GitHub repository
2. Initialize Node.js/TypeScript project
3. Set up basic project structure
4. Install core dependencies
5. Create `.env.example` with required variables

### Phase 2: Local Development
1. Implement Slack Bolt app setup
2. Create basic event handlers (mention, DM)
3. Integrate Claude SDK
4. Implement session management (SQLite)
5. Test locally with Slack sandbox

### Phase 3: Railway Deployment
1. Create Railway project
2. Configure persistent volume
3. Set environment variables
4. Deploy initial version
5. Configure Slack app with Railway URL

### Phase 4: Testing & Refinement
1. Test in real Slack workspace
2. Monitor session storage growth
3. Test session persistence across restarts
4. Refine error handling
5. Optimize response formatting

### Phase 5: Production Hardening
1. Add comprehensive logging
2. Implement cleanup jobs
3. Add health monitoring
4. Set up alerts
5. Document operations runbook

---

## References

### Related Documentation
- [Claude Agent SDK - TypeScript Reference](../claude_agent_sdk/typescript_sdk.md)
- [Session Management Guide](./SESSION_MANAGEMENT.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Architecture Guide](./ARCHITECTURE_GUIDE.md)

### External Resources
- [Slack Bolt for JavaScript](https://slack.dev/bolt-js/)
- [Railway Documentation](https://docs.railway.app/)
- [Claude Agent SDK Guide](https://docs.anthropic.com/en/docs/claude-code/agent-sdk)

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2025-10-30 | Initial | Created comprehensive requirements document |

