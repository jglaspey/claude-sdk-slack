# Slack Features Roadmap

**Status:** Foundation Ready → Feature Expansion  
**Prerequisite:** Complete Code Quality Audit (00_CODE_QUALITY_AUDIT.md)

---

## Overview

This roadmap builds on the existing working bot to add Slack-native capabilities. Each phase is designed to be shipped independently.

**Current State:**
- ✅ Responds to @mentions in channels
- ✅ Responds to DMs
- ✅ Maintains thread context
- ✅ Session persistence across restarts

**Foundation Gaps:**
- ❌ No slash commands
- ❌ No file handling
- ❌ No user @mention detection
- ❌ No Block Kit UI (rich formatting)
- ❌ No shortcuts/actions

---

## Phase 1: Essential Slack UX (1-2 days)

### 1.1 Thread Discipline & Progressive Responses

**Current Problem:** Bot posts "Processing..." then updates with full response. For 30+ second queries, this feels broken.

**Solution:** 
- Keep "Processing..." message
- Update it every 3 seconds with partial response from stream
- Show "🔄 Still thinking..." indicator if still streaming

**Implementation:**
```typescript
// In messageHandler.ts
let lastUpdate = Date.now();
let accumulated = '';

for await (const message of result) {
  if (message.type === 'assistant') {
    accumulated += extractText(message);
    
    // Update every 3 seconds
    if (Date.now() - lastUpdate > 3000) {
      await client.chat.update({
        channel: channelId,
        ts: thinkingMessage.ts,
        text: accumulated + '\n\n🔄 _Still thinking..._'
      });
      lastUpdate = Date.now();
    }
  }
}

// Final update without indicator
await client.chat.update({
  text: accumulated
});
```

**Success Criteria:**
- User sees progress every 3 seconds
- Final message has no "thinking" indicator
- Works in both DMs and threads

---

### 1.2 Smart Mention Detection

**Current:** Basic bot mention removal with regex

**Enhancement:** 
- Detect @mentions of other users
- Extract user info (name, real_name, profile) from Slack API
- Pass as context to Agent SDK

**Use Case:**
```
User: "@bot what does @john usually work on?"
Bot: *fetches John's profile, includes context about John*
```

**Implementation:**
```typescript
// Add to messageHandler.ts
async function extractUserMentions(text: string, client: WebClient) {
  const mentionPattern = /<@(U[A-Z0-9]+)>/g;
  const mentions: Array<{id: string, name: string, realName: string}> = [];
  
  let match;
  while ((match = mentionPattern.exec(text)) !== null) {
    const userId = match[1];
    const userInfo = await client.users.info({ user: userId });
    
    if (userInfo.user) {
      mentions.push({
        id: userId,
        name: userInfo.user.name || '',
        realName: userInfo.user.real_name || '',
      });
    }
  }
  
  return mentions;
}

// Add to system prompt
const mentionContext = mentions.length > 0
  ? `User mentions in this message: ${mentions.map(m => 
      `@${m.name} (${m.realName})`).join(', ')}`
  : '';
```

**Slack Permissions Needed:** `users:read`

**Success Criteria:**
- Bot recognizes user mentions
- Provides context about mentioned users
- Handles invalid/deleted user IDs gracefully

---

### 1.3 Basic Slash Commands

**Add stubs for future expansion:**
- `/claude-reset` - End current session, start fresh
- `/claude-status` - Show session info (session ID, turns, model)

**Implementation:**
```typescript
// In slackApp.ts
app.command('/claude-reset', async ({ command, ack, respond }) => {
  await ack();
  
  const sessionKey = getSessionKey({
    teamId: command.team_id,
    userId: command.user_id,
    channelId: command.channel_id,
    threadTs: '', // DM or channel
  });
  
  await sessionManager.deleteSession(sessionKey);
  
  await respond({
    text: '✅ Session reset. Your next message will start a fresh conversation.',
    response_type: 'ephemeral',
  });
});

app.command('/claude-status', async ({ command, ack, respond }) => {
  await ack();
  
  const sessionKey = getSessionKey({...});
  const session = await sessionManager.getSession(sessionKey);
  
  if (!session) {
    await respond({
      text: 'No active session. Start a conversation first.',
      response_type: 'ephemeral',
    });
    return;
  }
  
  await respond({
    text: [
      `📊 *Session Status*`,
      `• Session ID: \`${session.agent_session_id}\``,
      `• Messages: ${session.message_count}`,
      `• Started: ${new Date(session.created_at).toLocaleString()}`,
      `• Last active: ${new Date(session.last_active_at).toLocaleString()}`,
    ].join('\n'),
    response_type: 'ephemeral',
  });
});
```

**Slack App Setup:**
- Create slash commands in app settings
- Add command URLs: `https://your-app.railway.app/slack/events`
- Commands are auto-acknowledged by Bolt

**Success Criteria:**
- `/claude-reset` clears session and confirms
- `/claude-status` shows current session metadata
- Both work in DMs and channels

---

## Phase 2: File & Rich Content (2-3 days)

### 2.1 File Upload Detection

**Feature:** Auto-detect when user uploads a file in a thread with the bot

**Implementation:**
```typescript
// In slackApp.ts
app.event('file_shared', async ({ event, client }) => {
  // Get file info
  const fileInfo = await client.files.info({ file: event.file_id });
  
  if (!fileInfo.file) return;
  
  // Only process if in a bot thread or DM
  // ... session key logic ...
  
  // Download file (if small enough)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (fileInfo.file.size > maxSize) {
    await client.chat.postMessage({
      channel: event.channel_id,
      text: `File too large (${formatBytes(fileInfo.file.size)}). Max size: 10MB.`,
    });
    return;
  }
  
  // Download file content
  const response = await fetch(fileInfo.file.url_private, {
    headers: { Authorization: `Bearer ${config.slack.botToken}` }
  });
  const content = await response.text();
  
  // Send to Agent SDK with special prompt
  await queryClaudeAgent(
    `User uploaded a file: ${fileInfo.file.name}\n\nContent:\n${content}\n\nPlease analyze this file and provide insights.`,
    sessionId
  );
});
```

**Slack Permissions Needed:** `files:read`

**Limitations:** 
- Text files only (PDF/images require Agent SDK tools)
- 10MB size limit
- Requires Agent SDK `Read` tool enabled for smarter processing

**Success Criteria:**
- Bot auto-responds to text file uploads
- Provides summary or analysis
- Handles binary files gracefully (error message)

---

### 2.2 Block Kit Rich Formatting

**Current:** Plain text responses

**Enhancement:** Format responses with Block Kit for better UX

**Example Response:**
```typescript
await client.chat.update({
  channel: channelId,
  ts: messageTs,
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: response
      }
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '🔄 Regenerate' },
          action_id: 'regenerate_response',
          value: sessionKey,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '📋 Summarize' },
          action_id: 'summarize_response',
          value: sessionKey,
        }
      ]
    }
  ]
});
```

**Action Handlers:**
```typescript
app.action('regenerate_response', async ({ action, ack, client, body }) => {
  await ack();
  
  // Get last user message from session
  // Re-query Agent SDK with same prompt
  // Update message with new response
});
```

**Success Criteria:**
- Responses use mrkdwn formatting
- Action buttons work correctly
- Mobile and desktop rendering is clean

---

### 2.3 Ephemeral Helpers

**Use Case:** User @mentions bot in a busy channel

**Current:** Bot replies in channel (can be noisy)

**Better:** Post ephemeral message to user suggesting thread use

```typescript
// In slackApp.ts app_mention handler
if (!event.thread_ts) {
  // First mention in channel (not in thread)
  await client.chat.postEphemeral({
    channel: event.channel,
    user: event.user,
    text: '💡 _Tip: For longer conversations, I\'ll create a thread. Reply there to keep chatting!_'
  });
}

// Then proceed with normal thread handling
```

**Success Criteria:**
- Only message author sees the tip
- Doesn't clutter channel
- Appears immediately (before AI response)

---

## Phase 3: Advanced Slash Commands (3-4 days)

### 3.1 One-Shot `/ask` Command

**Use Case:** Quick question without session persistence

```bash
/ask What's the capital of France?
```

**Implementation:**
```typescript
app.command('/ask', async ({ command, ack, respond }) => {
  await ack();
  
  // Show immediate response
  await respond({
    text: '🤔 _Thinking..._',
    response_type: 'ephemeral',
  });
  
  // Query without session resumption
  const { response } = await queryClaudeAgent(command.text, undefined);
  
  // Update with answer
  await respond({
    text: response,
    response_type: 'ephemeral',
    replace_original: true,
  });
});
```

**Success Criteria:**
- No session created
- Fast responses (no context loading)
- Only user sees response (ephemeral)

---

### 3.2 `/summarize` Command

**Use Case:** Summarize the current thread

```bash
/summarize
```

**Implementation:**
```typescript
app.command('/summarize', async ({ command, ack, respond, client }) => {
  await ack();
  
  // Get thread messages
  const result = await client.conversations.replies({
    channel: command.channel_id,
    ts: command.thread_ts || command.message_ts,
    limit: 50,
  });
  
  // Extract text from messages
  const transcript = result.messages
    .filter(m => !m.bot_id) // Exclude bot messages
    .map(m => `${m.user}: ${m.text}`)
    .join('\n');
  
  // Query Agent SDK for summary
  const { response } = await queryClaudeAgent(
    `Summarize this Slack thread:\n\n${transcript}`,
    undefined // No session
  );
  
  await respond({ text: response, response_type: 'in_channel' });
});
```

**Slack Permissions Needed:** `channels:history`, `groups:history`

**Success Criteria:**
- Summarizes last 50 messages
- Posts summary in thread
- Handles long threads gracefully

---

### 3.3 `/research` Command (Requires Agent SDK Task Tool)

**Use Case:** Background research with progress updates

```bash
/research latest trends in AI agents
```

**Implementation:**
```typescript
app.command('/research', async ({ command, ack, respond, client }) => {
  await ack();
  
  // Post initial status
  const statusMsg = await client.chat.postMessage({
    channel: command.channel_id,
    text: `🔍 *Research Task Started*\nTopic: ${command.text}\n\n_Initializing..._`
  });
  
  // Enable Task tool for sub-agent
  const { response, sessionId } = await queryClaudeAgent(
    `Research this topic and provide a comprehensive summary: ${command.text}`,
    undefined,
    {
      allowedTools: ['Task', 'WebFetch', 'Read'],
      onProgress: async (update) => {
        // Update status message with milestones
        await client.chat.update({
          channel: command.channel_id,
          ts: statusMsg.ts,
          text: `🔍 *Research Task*\n${command.text}\n\n${update}`
        });
      }
    }
  );
  
  // Final update
  await client.chat.update({
    channel: command.channel_id,
    ts: statusMsg.ts,
    text: `✅ *Research Complete*\n\n${response}`
  });
});
```

**Prerequisites:** Agent SDK Task tool enabled (see Phase 4 of Agent SDK Roadmap)

**Success Criteria:**
- Shows progress as research happens
- Can take 2-5 minutes for deep research
- Final summary is comprehensive

---

## Phase 4: Channel-Aware Features (2-3 days)

### 4.1 Channel Memory/Context

**Use Case:** Bot remembers channel-specific info (team conventions, glossaries)

**Implementation:**
```typescript
// New table in sessionManager.ts
CREATE TABLE channel_memory (
  channel_id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  facts TEXT, -- JSON array of facts
  created_at INTEGER,
  updated_at INTEGER
);

// New slash command
app.command('/claude-remember', async ({ command, ack, respond }) => {
  await ack();
  
  // Parse: /claude-remember <fact>
  await channelMemory.addFact(command.channel_id, command.text);
  
  await respond({
    text: `✅ Remembered: "${command.text}"`,
    response_type: 'ephemeral',
  });
});

// Inject channel facts into system prompt
const facts = await channelMemory.getFacts(channelId);
const systemPromptAppend = facts.length > 0
  ? `\n\nChannel context: ${facts.join('; ')}`
  : '';
```

**Related Commands:**
- `/claude-remember <fact>` - Add fact
- `/claude-forget <fact>` - Remove fact  
- `/claude-memories` - List all facts

**Success Criteria:**
- Facts persist across sessions
- Automatically included in bot responses
- Can be managed by channel admins

---

### 4.2 Allowlist Channels (Safety Feature)

**Use Case:** Limit bot to specific channels

**Implementation:**
```typescript
// In config.ts
slack: {
  allowedChannels: process.env.ALLOWED_CHANNELS?.split(',') || [],
  mentionOnlyMode: process.env.MENTION_ONLY_MODE === 'true',
}

// In slackApp.ts
app.event('app_mention', async ({ event }) => {
  // Check if channel is allowed
  if (config.slack.allowedChannels.length > 0) {
    if (!config.slack.allowedChannels.includes(event.channel)) {
      await client.chat.postEphemeral({
        channel: event.channel,
        user: event.user,
        text: '🚫 This bot is not enabled in this channel.',
      });
      return;
    }
  }
  
  // Continue with normal handling
});
```

**Success Criteria:**
- Bot only responds in allowlisted channels
- Graceful rejection message
- Easy to configure via env var

---

## Phase 5: Cost Control & Observability (1-2 days)

### 5.1 Usage Tracking

**Implementation:**
```typescript
// New table
CREATE TABLE usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER,
  user_id TEXT,
  channel_id TEXT,
  team_id TEXT,
  session_id TEXT,
  turns INTEGER,
  cost_usd REAL,
  latency_ms INTEGER
);

// In queryClaudeAgent, after result
await usageTracker.log({
  userId: context.userId,
  channelId: context.channelId,
  sessionId: newSessionId,
  turns: result.num_turns,
  costUsd: result.total_cost_usd,
  latencyMs: Date.now() - startTime,
});
```

**Slash Command:**
```typescript
app.command('/claude-usage', async ({ command, ack, respond }) => {
  await ack();
  
  const stats = await usageTracker.getStats({
    userId: command.user_id,
    period: '24h'
  });
  
  await respond({
    text: [
      `📊 *Your Usage (Last 24h)*`,
      `• Queries: ${stats.queryCount}`,
      `• Total cost: $${stats.totalCost.toFixed(4)}`,
      `• Avg latency: ${stats.avgLatency.toFixed(0)}ms`,
    ].join('\n'),
    response_type: 'ephemeral',
  });
});
```

**Success Criteria:**
- Tracks per-user and per-channel costs
- Shows usage via slash command
- Data retained for 30 days

---

### 5.2 Rate Limiting

**Implementation:**
```typescript
// Simple in-memory rate limiter
class RateLimiter {
  private requests = new Map<string, number[]>();
  
  async checkLimit(userId: string, maxPerHour: number): Promise<boolean> {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    
    const userRequests = this.requests.get(userId) || [];
    const recentRequests = userRequests.filter(ts => ts > hourAgo);
    
    if (recentRequests.length >= maxPerHour) {
      return false; // Rate limited
    }
    
    recentRequests.push(now);
    this.requests.set(userId, recentRequests);
    return true;
  }
}

// In messageHandler
if (!await rateLimiter.checkLimit(context.userId, 20)) {
  await client.chat.postEphemeral({
    channel: context.channelId,
    user: context.userId,
    text: '🚦 Rate limit reached. Try again in an hour.',
  });
  return;
}
```

**Success Criteria:**
- Users limited to 20 requests/hour (configurable)
- Clear error message when limited
- Resets every hour

---

## Implementation Priority Matrix

| Feature | User Value | Dev Effort | Dependencies | Priority |
|---------|-----------|------------|--------------|----------|
| Progressive responses | HIGH | LOW | None | **P0** |
| Slash command stubs | MEDIUM | LOW | None | **P0** |
| User mentions | MEDIUM | MEDIUM | users:read | **P1** |
| Block Kit UI | HIGH | MEDIUM | None | **P1** |
| File upload | HIGH | HIGH | files:read | **P2** |
| /ask command | MEDIUM | LOW | None | **P2** |
| /summarize | HIGH | MEDIUM | history scopes | **P2** |
| Channel memory | MEDIUM | HIGH | None | **P3** |
| Usage tracking | LOW | MEDIUM | None | **P3** |
| Rate limiting | MEDIUM | LOW | None | **P3** |

---

## Slack Permissions Checklist

**Currently Required:**
- ✅ `app_mentions:read`
- ✅ `chat:write`
- ✅ `channels:history`
- ✅ `groups:history`
- ✅ `im:history`
- ✅ `im:write`

**New Permissions Needed:**
- `users:read` - For user mention detection
- `files:read` - For file upload handling
- `commands` - For slash commands (auto-granted)

**Update:** Go to Slack App settings → OAuth & Permissions → Add scopes → Reinstall app

---

## Testing Checklist

For each feature:
- [ ] Works in DMs
- [ ] Works in public channels
- [ ] Works in private channels
- [ ] Works in threads
- [ ] Handles errors gracefully
- [ ] Mobile rendering is correct
- [ ] Desktop rendering is correct

---

*Next: See 02_AGENT_SDK_ROADMAP.md for Agent SDK feature expansion*
