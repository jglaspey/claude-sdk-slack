# Implementation Plan

**Status:** Roadmap → Executable Plan  
**Timeline:** 4-6 weeks (part-time) or 2-3 weeks (full-time)

---

## Overview

This plan sequences work from the three roadmap documents into actionable sprints. Each sprint delivers working features.

**Approach:**
1. **Foundation First** - Clean up tech debt before building
2. **Horizontal Slices** - Each sprint ships user-facing value
3. **Incremental Safety** - Start with safe features, add risky ones with controls
4. **Test as You Go** - Manual testing in real Slack workspace

---

## Sprint 0: Foundation Cleanup (2-3 days)

**Goal:** Clean codebase, fix inconsistencies, update documentation

### Tasks

#### 1. Deployment Strategy Decision
- [ ] **Decide:** Nixpacks or Docker?
- [ ] **If Nixpacks:** Delete Dockerfile, docker-entrypoint.sh, .dockerignore, wrappers
- [ ] **If Docker:** Update Dockerfile to remove debug/troubleshooting code
- [ ] Update `railway.toml` to match choice
- [ ] Test deployment to Railway

**Files to modify:**
- `railway.toml`
- Delete: `claude-wrapper.sh`, `claude-wrapper.js`, `docker-entrypoint.sh` (if Nixpacks)

---

#### 2. Config Cleanup
```typescript
// Remove from config.ts
slack: {
  botToken: process.env.SLACK_BOT_TOKEN || '',
  signingSecret: process.env.SLACK_SIGNING_SECRET || '',
  // appToken: process.env.SLACK_APP_TOKEN || '', // DELETE THIS
}
```

```bash
# Remove from .env.example
# SLACK_APP_TOKEN=xapp-your-app-token  # DELETE THIS
```

**Files to modify:**
- `src/config.ts`
- `.env.example`

---

#### 3. Add Configuration for Timeouts
```typescript
// In config.ts
app: {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  shutdownTimeoutSeconds: parseInt(process.env.SHUTDOWN_TIMEOUT_SECONDS || '30', 10),
  agentTimeoutSeconds: parseInt(process.env.AGENT_TIMEOUT_SECONDS || '120', 10),
}
```

```typescript
// In index.ts
const timeout = setTimeout(() => {
  console.log('Shutdown timeout reached, forcing exit');
  process.exit(1);
}, config.app.shutdownTimeoutSeconds * 1000);
```

**Files to modify:**
- `src/config.ts`
- `src/index.ts`

---

#### 4. Update README
- [ ] Change "Claude API" → "Claude Agent SDK"
- [ ] Add "Current Limitations" section
- [ ] Document disabled tools
- [ ] Add deployment strategy (Nixpacks or Docker)
- [ ] Update troubleshooting with real examples

**Files to modify:**
- `README.md`

---

#### 5. Add Session Manager Error Handling
```typescript
// In sessionManager.ts
private startCleanupJob(): void {
  const intervalMs = config.session.cleanupIntervalHours * 60 * 60 * 1000;
  let consecutiveFailures = 0;
  const MAX_FAILURES = 3;

  setInterval(() => {
    console.log('[SessionManager] Running cleanup job...');
    this.cleanupInactiveSessions()
      .then(() => {
        consecutiveFailures = 0; // Reset on success
      })
      .catch((error) => {
        consecutiveFailures++;
        console.error(`[SessionManager] Cleanup job failed (${consecutiveFailures}/${MAX_FAILURES}):`, error);
        
        if (consecutiveFailures >= MAX_FAILURES) {
          console.error('[SessionManager] Too many cleanup failures, manual intervention needed');
          // TODO: Send alert to monitoring system
        }
      });
  }, intervalMs);
}
```

**Files to modify:**
- `src/agent/sessionManager.ts`

---

### Sprint 0 Acceptance Criteria
- [ ] Deployment works to Railway
- [ ] No unused configuration
- [ ] README accurately describes the bot
- [ ] Timeouts are configurable
- [ ] Session cleanup has error handling

---

## Sprint 1: Slack UX Improvements (3-4 days)

**Goal:** Better user experience with progressive updates and basic commands

### Tasks

#### 1.1 Progressive Response Updates

**Create streaming helper:**
```typescript
// New file: src/slack/streamingUpdater.ts
export class StreamingUpdater {
  private lastUpdateTime = 0;
  private updateIntervalMs = 3000;
  private accumulated = '';
  
  constructor(
    private client: WebClient,
    private channelId: string,
    private messageTs: string
  ) {}
  
  async addContent(content: string): Promise<void> {
    this.accumulated += content;
    
    const now = Date.now();
    if (now - this.lastUpdateTime >= this.updateIntervalMs) {
      await this.update(true); // With indicator
      this.lastUpdateTime = now;
    }
  }
  
  async finalize(): Promise<void> {
    await this.update(false); // Without indicator
  }
  
  private async update(showIndicator: boolean): Promise<void> {
    const text = showIndicator
      ? this.accumulated + '\n\n🔄 _Still thinking..._'
      : this.accumulated;
      
    await this.client.chat.update({
      channel: this.channelId,
      ts: this.messageTs,
      text: text,
    });
  }
}
```

**Update messageHandler.ts:**
```typescript
// In handleMessage
const updater = new StreamingUpdater(client, channelId, thinkingMessage.ts);

for await (const message of result) {
  if (message.type === 'assistant') {
    const textContent = message.message.content.find(
      (block: any) => block.type === 'text'
    );
    if (textContent && 'text' in textContent) {
      await updater.addContent(textContent.text);
    }
  }
}

await updater.finalize();
```

**Files to modify:**
- Create: `src/slack/streamingUpdater.ts`
- Update: `src/slack/messageHandler.ts`

---

#### 1.2 Basic Slash Commands

**Add command handlers to slackApp.ts:**
```typescript
// /claude-reset command
app.command('/claude-reset', async ({ command, ack, respond }) => {
  await ack();
  
  const sessionKey = `${command.team_id}-${command.channel_id.startsWith('D') ? command.user_id + '-dm' : command.channel_id + '-' + (command.message?.thread_ts || '')}`;
  
  const sessionManager = getSessionManager();
  await sessionManager.deleteSession(sessionKey);
  
  await respond({
    text: '✅ Session reset. Your next message will start a fresh conversation.',
    response_type: 'ephemeral',
  });
});

// /claude-status command
app.command('/claude-status', async ({ command, ack, respond }) => {
  await ack();
  
  const sessionKey = `${command.team_id}-${command.channel_id.startsWith('D') ? command.user_id + '-dm' : command.channel_id + '-' + (command.message?.thread_ts || '')}`;
  
  const sessionManager = getSessionManager();
  const stats = sessionManager.getStats();
  
  // Get specific session if exists
  // Note: Need to add getSession method to SessionManager
  
  await respond({
    text: [
      `📊 *Bot Status*`,
      `• Total sessions: ${stats.totalSessions}`,
      `• Active sessions: ${stats.activeSessions}`,
      `• Uptime: ${formatUptime(process.uptime())}`,
    ].join('\n'),
    response_type: 'ephemeral',
  });
});
```

**Add helper function:**
```typescript
function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}
```

**Slack App Configuration:**
- Go to Slack App settings → Slash Commands
- Add `/claude-reset` with Request URL: `https://your-app.railway.app/slack/events`
- Add `/claude-status` with same URL

**Files to modify:**
- `src/slack/slackApp.ts`

---

#### 1.3 Better Error Messages

**Create error categorizer:**
```typescript
// New file: src/slack/errorHandler.ts
export function getErrorMessage(error: any): string {
  // API rate limit
  if (error.message?.includes('rate limit') || error.status === 429) {
    return '🚦 I\'m at capacity right now. Please try again in a few minutes.';
  }
  
  // Timeout
  if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
    return '⏱️ This is taking too long. Try breaking your question into smaller parts.';
  }
  
  // API error
  if (error.status >= 500) {
    return '⚠️ The AI service is temporarily unavailable. Please try again shortly.';
  }
  
  // Authentication
  if (error.status === 401 || error.message?.includes('API key')) {
    return '🔑 Configuration error. Please contact the bot administrator.';
  }
  
  // Generic
  return '❌ Something went wrong. Please try again or start a new conversation with `/claude-reset`.';
}
```

**Update messageHandler.ts:**
```typescript
} catch (error) {
  console.error('[handleMessage] Fatal error:', error);
  
  const errorMessage = getErrorMessage(error);
  
  await client.chat.postMessage({
    channel: channelId,
    thread_ts: threadTs,
    text: errorMessage,
  });
}
```

**Files to modify:**
- Create: `src/slack/errorHandler.ts`
- Update: `src/slack/messageHandler.ts`

---

### Sprint 1 Acceptance Criteria
- [ ] Responses update every 3 seconds during processing
- [ ] `/claude-reset` clears session
- [ ] `/claude-status` shows bot info
- [ ] Error messages are specific and helpful
- [ ] Tested in real Slack workspace

---

## Sprint 2: Enable Safe Agent Tools (2-3 days)

**Goal:** Enable read-only Agent SDK capabilities

### Tasks

#### 2.1 Enable Read Tool

**Update claudeAgent.ts:**
```typescript
disallowedTools: [
  // 'Read', // ✅ ENABLED
  'Write', 'Edit', 'Glob', 'Grep',
  'Bash', 'BashOutput', 'KillShell',
  'NotebookEdit', 'Task',
],
```

**Test cases:**
- "Read this URL: https://example.com"
- "Summarize this article: [URL]"
- Upload a text file → "What's in this file?"

**Files to modify:**
- `src/agent/claudeAgent.ts`

---

#### 2.2 Add Agent Timeout

**Update claudeAgent.ts:**
```typescript
export async function queryClaudeAgent(
  prompt: string,
  sessionId?: string,
  timeoutSeconds?: number
): Promise<{ response: string; sessionId: string }> {
  const timeout = timeoutSeconds || config.app.agentTimeoutSeconds;
  
  // Create abort controller
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn(`[queryClaudeAgent] Timeout after ${timeout}s`);
    abortController.abort();
  }, timeout * 1000);
  
  try {
    // Query with abort signal
    const result = query({
      prompt,
      options: {
        ...options,
        signal: abortController.signal, // If SDK supports
      },
    });
    
    // ... collect response ...
    
    clearTimeout(timeoutId);
    return { response: fullResponse, sessionId: newSessionId };
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Agent query timed out');
    }
    throw error;
  }
}
```

**Files to modify:**
- `src/agent/claudeAgent.ts`

---

### Sprint 2 Acceptance Criteria
- [ ] Agent can read URLs
- [ ] Agent can read uploaded text files
- [ ] Queries timeout after configured duration
- [ ] Timeout errors are user-friendly

---

## Sprint 3: Structured Logging (2 days)

**Goal:** Replace console.log with structured logging

### Tasks

#### 3.1 Install Logging Library

```bash
npm install pino pino-pretty
```

#### 3.2 Create Logger

```typescript
// New file: src/utils/logger.ts
import pino from 'pino';
import { config } from '../config.js';

export const logger = pino({
  level: config.app.logLevel,
  transport: config.app.nodeEnv === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    }
  } : undefined,
});

// Create child loggers for each module
export const slackLogger = logger.child({ module: 'slack' });
export const agentLogger = logger.child({ module: 'agent' });
export const sessionLogger = logger.child({ module: 'session' });
```

#### 3.3 Replace Console Logs

**Example in messageHandler.ts:**
```typescript
// Before
console.log(`[handleMessage] Processing message for session: ${sessionKey}`);

// After
import { slackLogger } from '../utils/logger.js';
slackLogger.info({ sessionKey }, 'Processing message');
```

**Files to modify:**
- Create: `src/utils/logger.ts`
- Update: All source files (replace console.log/error)

---

### Sprint 3 Acceptance Criteria
- [ ] All logging uses pino
- [ ] Logs include structured context (sessionId, userId, etc.)
- [ ] Development mode shows pretty logs
- [ ] Production mode outputs JSON for log aggregation

---

## Sprint 4: User Mentions & File Support (3-4 days)

**Goal:** Detect @mentions and handle file uploads

### Tasks

#### 4.1 User Mention Detection

**Add Slack permission:**
- `users:read` in OAuth & Permissions

**Update messageHandler.ts:**
```typescript
async function extractUserMentions(
  text: string, 
  client: WebClient
): Promise<Array<{id: string; name: string; realName: string}>> {
  const mentionPattern = /<@(U[A-Z0-9]+)>/g;
  const mentions: Array<{id: string; name: string; realName: string}> = [];
  
  let match;
  while ((match = mentionPattern.exec(text)) !== null) {
    const userId = match[1];
    try {
      const userInfo = await client.users.info({ user: userId });
      if (userInfo.user) {
        mentions.push({
          id: userId,
          name: userInfo.user.name || 'unknown',
          realName: userInfo.user.real_name || 'Unknown User',
        });
      }
    } catch (error) {
      slackLogger.warn({ userId }, 'Failed to fetch user info');
    }
  }
  
  return mentions;
}

// In handleMessage, before queryClaudeAgent
const mentions = await extractUserMentions(cleanText, client);
const mentionContext = mentions.length > 0
  ? `\n\nNote: This message mentions: ${mentions.map(m => `@${m.name} (${m.realName})`).join(', ')}`
  : '';

const promptWithContext = cleanText + mentionContext;
```

**Files to modify:**
- `src/slack/messageHandler.ts`

---

#### 4.2 File Upload Handling

**Add Slack permission:**
- `files:read` in OAuth & Permissions

**Add file event handler in slackApp.ts:**
```typescript
app.event('message', async ({ event, client }) => {
  // Existing DM handler logic...
  
  // Check for file attachments
  if ('files' in event && event.files && event.files.length > 0) {
    await handleFileUpload(event, client);
  }
});

async function handleFileUpload(event: any, client: WebClient) {
  const file = event.files[0]; // Handle first file
  
  // Size check
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts || event.ts,
      text: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: 10MB.`,
    });
    return;
  }
  
  // Only handle text files
  if (!file.mimetype?.startsWith('text/')) {
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts || event.ts,
      text: `I can only read text files right now. This file is: ${file.mimetype}`,
    });
    return;
  }
  
  // Download file
  const response = await fetch(file.url_private, {
    headers: { Authorization: `Bearer ${config.slack.botToken}` }
  });
  const content = await response.text();
  
  // Send to handler with special prompt
  await handleMessage({
    text: `User uploaded file: ${file.name}\n\nPlease analyze this file:\n\n${content}`,
    userId: event.user,
    channelId: event.channel,
    threadTs: event.thread_ts || event.ts,
    ts: event.ts,
    teamId: event.team || '',
    client,
  });
}
```

**Files to modify:**
- `src/slack/slackApp.ts`

---

### Sprint 4 Acceptance Criteria
- [ ] Bot recognizes @user mentions
- [ ] Mentioned user info included in context
- [ ] Text file uploads trigger analysis
- [ ] Large files rejected gracefully
- [ ] Binary files rejected gracefully

---

## Sprint 5: Block Kit & Actions (3-4 days)

**Goal:** Rich Slack UI with interactive buttons

### Tasks

#### 5.1 Block Kit Response Formatting

**Update messageHandler.ts:**
```typescript
// In handleMessage, final response
const blocks = [
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: convertToSlackMarkdown(response),
    }
  },
  {
    type: 'actions',
    block_id: 'response_actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: '🔄 Regenerate', emoji: true },
        action_id: 'regenerate_response',
        value: sessionKey,
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: '📋 Shorter', emoji: true },
        action_id: 'make_shorter',
        value: sessionKey,
      }
    ]
  }
];

await client.chat.update({
  channel: channelId,
  ts: thinkingMessage.ts,
  blocks: blocks,
  text: response, // Fallback for notifications
});
```

**Add markdown converter:**
```typescript
// New file: src/slack/markdownConverter.ts
export function convertToSlackMarkdown(markdown: string): string {
  return markdown
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '```$2```')
    .replace(/(\*\*|__)(.*?)\1/g, '*$2*')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>')
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*');
}
```

**Files to modify:**
- Create: `src/slack/markdownConverter.ts`
- Update: `src/slack/messageHandler.ts`

---

#### 5.2 Action Handlers

**Add to slackApp.ts:**
```typescript
app.action('regenerate_response', async ({ ack, body, client }) => {
  await ack();
  
  // Extract session key from button value
  const sessionKey = (body as any).actions[0].value;
  
  // Get last user message (need to track in session)
  // For now, just indicate regeneration
  await client.chat.postEphemeral({
    channel: body.channel?.id || '',
    user: body.user.id,
    text: '🔄 Regenerating response... (coming soon)',
  });
});

app.action('make_shorter', async ({ ack, body, client }) => {
  await ack();
  
  const sessionKey = (body as any).actions[0].value;
  
  // Get original response and shorten it
  await client.chat.postEphemeral({
    channel: body.channel?.id || '',
    user: body.user.id,
    text: '📋 Making it shorter... (coming soon)',
  });
});
```

**Files to modify:**
- `src/slack/slackApp.ts`

---

### Sprint 5 Acceptance Criteria
- [ ] Responses use Block Kit formatting
- [ ] Buttons appear below responses
- [ ] Button clicks are acknowledged
- [ ] Markdown converts correctly to Slack format

---

## Optional Sprints (Based on Priority)

### Sprint 6: Permission Mode & Write Tool (4-5 days)
- Switch to `permissionMode: 'ask'`
- Implement Slack approval UI
- Enable Write tool with approvals
- Upload generated files to Slack

### Sprint 7: Sub-Agents & Task Tool (4-5 days)
- Enable Task tool
- Show sub-agent progress in threads
- Create specialized agent configs
- Add `/claude-agent` command

### Sprint 8: MCP Servers (5-7 days)
- Set up web search MCP
- Set up GitHub MCP
- Dynamic MCP loading
- Error handling for MCP failures

---

## Testing Strategy

### Manual Testing Checklist (Every Sprint)
- [ ] DMs work
- [ ] Channel mentions work
- [ ] Thread conversations work
- [ ] Error cases handled
- [ ] Mobile UI looks correct
- [ ] Desktop UI looks correct

### Integration Testing
- [ ] Railway deployment successful
- [ ] Volume persistence works
- [ ] Health check responds
- [ ] Slack events received

### Load Testing (Optional)
- [ ] Concurrent conversations (5+ users)
- [ ] Long-running sessions (20+ turns)
- [ ] File uploads (various sizes)

---

## Deployment Workflow

### After Each Sprint
1. **Local testing:** Test changes in dev environment
2. **Git commit:** Commit with clear message
3. **Railway deploy:** Push to main branch (auto-deploy)
4. **Smoke test:** Test one interaction in production Slack
5. **Monitor logs:** Check Railway logs for errors
6. **Rollback plan:** Keep previous working commit tagged

### Environment Variables Checklist
- [ ] `SLACK_BOT_TOKEN`
- [ ] `SLACK_SIGNING_SECRET`
- [ ] `ANTHROPIC_API_KEY`
- [ ] `PORT` (set to 3000)
- [ ] `NODE_ENV` (production)
- [ ] `SESSION_TTL_HOURS` (24)
- [ ] `RAILWAY_VOLUME_MOUNT_PATH` (/data - set by Railway)

---

## Risk Mitigation

### Technical Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Agent SDK timeout | HIGH | Add timeout controls (Sprint 2) |
| File upload abuse | MEDIUM | Size limits + type checking (Sprint 4) |
| Cost overrun | HIGH | Track usage (future sprint) + rate limits |
| Session DB corruption | MEDIUM | Regular backups of /data volume |

### UX Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Confusing error messages | MEDIUM | Categorized errors (Sprint 1) |
| Slow responses | HIGH | Progressive updates (Sprint 1) |
| Lost context | MEDIUM | Session persistence working |

---

## Success Metrics

### Sprint-Level Metrics
- [ ] All acceptance criteria met
- [ ] Zero critical bugs
- [ ] Deployment successful
- [ ] User testing positive

### Overall Project Metrics
- [ ] Bot responds < 5s (first update)
- [ ] Error rate < 5%
- [ ] Uptime > 99%
- [ ] User satisfaction (manual feedback)

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Set up project board** (GitHub Projects, Trello, etc.)
3. **Schedule Sprint 0** kickoff
4. **Prepare test Slack workspace** if needed
5. **Begin implementation**

---

*This is a living document. Update priorities and timelines as you learn.*
