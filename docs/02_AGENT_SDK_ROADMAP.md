# Agent SDK Features Roadmap

**Status:** Basic Query Mode → Full Agent Capabilities  
**Prerequisite:** Phase 1 of Code Quality Audit completed

---

## Overview

Currently, **ALL Agent SDK tools are disabled**. The bot only does text-based reasoning. This roadmap enables Agent SDK capabilities progressively with safety controls.

**Current State:**
```typescript
disallowedTools: [
  'Read', 'Write', 'Edit', 'Glob', 'Grep',
  'Bash', 'BashOutput', 'KillShell',
  'NotebookEdit', 'Task',
]
```

**Capabilities Locked:**
- ❌ Reading files/URLs
- ❌ Web search
- ❌ Code execution
- ❌ File editing
- ❌ Sub-agents (Task tool)
- ❌ MCP server integrations
- ❌ Skills
- ❌ Hooks

---

## Phase 1: Safe Read-Only Tools (1 day)

### 1.1 Enable Read Tool

**What it enables:**
- Reading files from URLs
- Reading local files (in session directory)

**Safety:**
- No write operations
- Isolated to session directory only
- No access to /app code

**Implementation:**
```typescript
// In claudeAgent.ts
disallowedTools: [
  // 'Read', // ✅ ENABLED
  'Write', 'Edit', 'Glob', 'Grep',
  'Bash', 'BashOutput', 'KillShell',
  'NotebookEdit', 'Task',
]
```

**Use Cases:**
- "Read this URL and summarize: https://..."
- "Analyze this JSON: {...}"
- User uploads text file → Agent reads it

**Testing:**
```
User: "Summarize this article: https://example.com/article"
Bot: *uses Read tool to fetch, then summarizes*
```

**Success Criteria:**
- Agent can fetch public URLs
- Handles 404s and timeouts gracefully
- Cannot read sensitive system files

---

### 1.2 Enable Grep Tool (Conditional)

**What it enables:**
- Search within files/URLs
- Pattern matching

**Safety:** Same as Read tool

**Implementation:**
```typescript
disallowedTools: [
  // 'Read', 'Grep', // ✅ ENABLED
  'Write', 'Edit', 'Glob',
  'Bash', 'BashOutput', 'KillShell',
  'NotebookEdit', 'Task',
]
```

**Use Cases:**
- "Find all email addresses in this document"
- "What sections mention 'pricing'?"

**Success Criteria:**
- Works with Read tool for file content
- Returns structured results

---

## Phase 2: Controlled Permission Mode (2-3 days)

### 2.1 Switch to 'ask' Permission Mode

**Current:** `permissionMode: 'bypassPermissions'` - Agent does anything without asking

**Change to:** `permissionMode: 'ask'` - Agent asks before risky operations

**Impact:**
- Agent will **request** permission for Write, Bash, etc.
- You implement approval flow in Slack

**Implementation:**
```typescript
// In claudeAgent.ts options
permissionMode: 'ask' as const,

// Add permission callback
onPermissionRequest: async (request) => {
  // Post approval buttons to Slack
  const result = await requestSlackApproval({
    userId: context.userId,
    channelId: context.channelId,
    tool: request.tool,
    params: request.params,
  });
  
  return result.approved;
}
```

**Slack Approval UI:**
```typescript
async function requestSlackApproval(request) {
  const approvalMessage = await client.chat.postMessage({
    channel: request.channelId,
    text: `⚠️ *Permission Request*\nClaude wants to use: \`${request.tool}\`\nParams: \`\`\`${JSON.stringify(request.params, null, 2)}\`\`\``,
    blocks: [
      // ... message blocks ...
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '✅ Approve' },
            style: 'primary',
            action_id: 'approve_permission',
            value: request.id,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '🚫 Deny' },
            style: 'danger',
            action_id: 'deny_permission',
            value: request.id,
          }
        ]
      }
    ]
  });
  
  // Wait for button click (with timeout)
  return await waitForApproval(request.id, 60000); // 60s timeout
}
```

**Success Criteria:**
- Agent requests permission before risky tools
- User sees clear description of what will happen
- Approval/denial works correctly
- Timeout falls back to deny

---

### 2.2 Enable Write Tool (With Approval)

**What it enables:**
- Create files in session directory
- Save generated content

**Safety:**
- Requires approval per operation
- Isolated to session directory
- Cannot overwrite app code

**Implementation:**
```typescript
disallowedTools: [
  // 'Read', 'Grep', 'Write', // ✅ ENABLED (with ask mode)
  'Edit', 'Glob',
  'Bash', 'BashOutput', 'KillShell',
  'NotebookEdit', 'Task',
]
```

**Use Cases:**
- "Generate a CSV report of this data"
- "Create a markdown document with these notes"

**Agent SDK Response:**
```
Agent: I've created a file: report.csv
*Agent SDK returns file path*
```

**Then in Slack:**
```typescript
// Detect file creation from agent response
if (response.includes('created a file')) {
  // Upload file to Slack
  const filePath = extractFilePath(response);
  await client.files.upload({
    channels: channelId,
    file: fs.createReadStream(filePath),
    title: path.basename(filePath),
  });
}
```

**Success Criteria:**
- Agent can create files
- Files uploaded to Slack thread
- User approves each write operation

---

## Phase 3: Sub-Agents with Task Tool (3-4 days)

### 3.1 Enable Task Tool

**What it enables:**
- Spawn sub-agents for parallel/specialized tasks
- Delegate complex workflows
- Multi-step reasoning

**Safety:**
- Sub-agents inherit parent permission mode
- Each sub-agent asks for approvals
- Controlled tool access per sub-agent

**Implementation:**
```typescript
disallowedTools: [
  // 'Read', 'Grep', 'Write', 'Task', // ✅ ENABLED
  'Edit', 'Glob',
  'Bash', 'BashOutput', 'KillShell',
  'NotebookEdit',
]
```

**Use Cases:**
```
User: "Research 3 competitors and compare their pricing"

Agent: I'll create 3 sub-agents to research each competitor in parallel.
  Task 1: Research Competitor A
  Task 2: Research Competitor B  
  Task 3: Research Competitor C
  
*Each sub-agent uses Read/WebFetch to gather info*
*Parent agent synthesizes results*

Agent: Here's the comparison table...
```

**Slack UX Enhancement:**
```typescript
// Show sub-agent progress
for await (const message of result) {
  if (message.type === 'task_start') {
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: `🔄 Started: ${message.task.description}`
    });
  }
  
  if (message.type === 'task_complete') {
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: `✅ Completed: ${message.task.description}`
    });
  }
}
```

**Success Criteria:**
- Parent agent can spawn sub-agents
- Sub-agents work in parallel
- Progress visible in Slack
- Results synthesized correctly

---

### 3.2 Specialized Sub-Agents

**Create pre-configured agent profiles:**

```typescript
// In .claude/agents/sql-helper.json
{
  "name": "SQL Helper",
  "systemPrompt": "You are an expert SQL assistant. Help users write queries.",
  "allowedTools": ["Read", "Grep"],
  "permissionMode": "ask"
}

// In .claude/agents/code-reviewer.json
{
  "name": "Code Reviewer",
  "systemPrompt": "You review code for bugs and best practices.",
  "allowedTools": ["Read", "Grep"],
  "permissionMode": "bypassPermissions"
}
```

**Slash Command:**
```typescript
app.command('/claude-agent', async ({ command, ack, respond }) => {
  await ack();
  
  // Parse: /claude-agent sql-helper "help me write a query"
  const [agentName, ...promptParts] = command.text.split(' ');
  const prompt = promptParts.join(' ');
  
  const agentConfig = await loadAgentConfig(agentName);
  
  const { response } = await queryClaudeAgent(prompt, undefined, {
    systemPrompt: agentConfig.systemPrompt,
    allowedTools: agentConfig.allowedTools,
    permissionMode: agentConfig.permissionMode,
  });
  
  await respond({ text: response });
});
```

**Success Criteria:**
- Can define agents in .claude/agents/
- Slash command routes to correct agent
- Each agent has scoped capabilities

---

## Phase 4: MCP Server Integration (4-5 days)

### 4.1 Core MCP Servers

**What are MCP servers?**
Model Context Protocol servers provide tools for external integrations (GitHub, Google Drive, databases, etc.).

**High-Value MCP Servers:**
1. **Web Search** - Brave/Google search
2. **GitHub** - Read repos, PRs, issues
3. **Google Drive** - Search and read docs
4. **Notion** - Read/search pages

**Implementation:**
```typescript
// In claudeAgent.ts
import { createMCPClient } from '@anthropic-ai/claude-agent-sdk';

// Initialize MCP servers
const mcpClients = await Promise.all([
  createMCPClient({ server: 'web-search', config: {...} }),
  createMCPClient({ server: 'github', config: {...} }),
]);

// Query with MCP tools available
const { response } = await query({
  prompt,
  options: {
    mcpClients,
    // ...other options
  }
});
```

**Configuration:**
```bash
# In .env
MCP_GITHUB_TOKEN=ghp_xxxxx
MCP_GOOGLE_CREDENTIALS=/path/to/creds.json
MCP_BRAVE_API_KEY=xxxxx
```

**Use Cases:**
```
User: "What are the latest issues on our repo?"
Agent: *uses GitHub MCP to fetch issues*
       "Here are the 5 most recent issues: ..."

User: "Search the web for Agent SDK tutorials"
Agent: *uses web-search MCP*
       "Here are the top 3 tutorials..."
```

**Success Criteria:**
- MCP servers initialize correctly
- Agent can use MCP tools
- Credentials secured via env vars
- Graceful fallback if MCP unavailable

---

### 4.2 Dynamic MCP Loading with Sub-Agents

**Problem:** Loading all MCP servers consumes context window

**Solution:** Load MCP servers on-demand per sub-agent

**Implementation:**
```typescript
async function queryWithDynamicMCP(prompt: string, sessionId?: string) {
  // Analyze prompt to determine needed MCP servers
  const neededMCPs = await detectRequiredMCPs(prompt);
  
  // Only initialize needed MCPs
  const mcpClients = await Promise.all(
    neededMCPs.map(name => createMCPClient({ server: name }))
  );
  
  return await query({
    prompt,
    options: {
      resume: sessionId,
      mcpClients,
    }
  });
}

function detectRequiredMCPs(prompt: string): string[] {
  const mcps: string[] = [];
  
  if (prompt.match(/github|repo|pr|issue/i)) {
    mcps.push('github');
  }
  if (prompt.match(/search|find online|google/i)) {
    mcps.push('web-search');
  }
  if (prompt.match(/google drive|docs|sheets/i)) {
    mcps.push('google-drive');
  }
  
  return mcps;
}
```

**Success Criteria:**
- Only needed MCPs loaded
- Context window stays under control
- Works with sub-agents

---

## Phase 5: Skills & Hooks (3-4 days)

### 5.1 Skills Overview

**What are Skills?**
Pre-defined prompt templates and workflows that the agent can invoke.

**Useful Skills for Slack Bot:**
1. **Meeting Notes** - Structure standup notes
2. **PR Review** - Generate code review template
3. **Incident Response** - Guide through incident workflow

**Implementation:**
```typescript
// In .claude/skills/meeting-notes.json
{
  "name": "meeting-notes",
  "description": "Structure meeting notes",
  "prompt": "Convert these raw notes into a structured meeting summary with: Date, Attendees, Topics, Action Items, Decisions",
  "requiredTools": ["Read"]
}
```

**Usage:**
```
User: "Help me organize these meeting notes: [pastes notes]"
Agent: *detects meeting-notes skill*
       *applies template*
       "Here's the structured summary..."
```

**Slash Command:**
```typescript
app.command('/claude-skill', async ({ command, ack, respond }) => {
  await ack();
  
  // Parse: /claude-skill meeting-notes <content>
  const [skillName, ...content] = command.text.split(' ');
  
  const skill = await loadSkill(skillName);
  const prompt = `${skill.prompt}\n\nContent: ${content.join(' ')}`;
  
  const { response } = await queryClaudeAgent(prompt, undefined, {
    allowedTools: skill.requiredTools,
  });
  
  await respond({ text: response });
});
```

**Success Criteria:**
- Skills defined in .claude/skills/
- Agent auto-detects applicable skills
- Slash command can invoke skills directly

---

### 5.2 Hooks Overview

**What are Hooks?**
Custom code that runs at specific points in the agent lifecycle.

**Useful Hooks:**
1. **onStart** - Log session start, send analytics
2. **onComplete** - Log usage, update metrics
3. **onError** - Send error to Sentry/Datadog
4. **onToolUse** - Audit tool usage

**Implementation:**
```typescript
// In .claude/hooks/slack-analytics.ts
export const hooks = {
  onStart: async (session) => {
    console.log(`[Analytics] Session started: ${session.id}`);
    await analytics.track('agent_session_start', {
      userId: session.metadata.userId,
      channelId: session.metadata.channelId,
    });
  },
  
  onComplete: async (session, result) => {
    console.log(`[Analytics] Session complete: ${session.id}`);
    await analytics.track('agent_session_complete', {
      userId: session.metadata.userId,
      turns: result.num_turns,
      cost: result.total_cost_usd,
    });
  },
  
  onError: async (session, error) => {
    console.error(`[Error] Session ${session.id}:`, error);
    await sentry.captureException(error, {
      tags: {
        sessionId: session.id,
        userId: session.metadata.userId,
      }
    });
  },
  
  onToolUse: async (session, tool, params) => {
    console.log(`[Audit] Tool used: ${tool}`, params);
    await auditLog.record({
      sessionId: session.id,
      tool,
      params,
      timestamp: Date.now(),
    });
  }
};
```

**Load Hooks:**
```typescript
// In claudeAgent.ts
const hooks = await import('./.claude/hooks/slack-analytics.js');

const { response } = await query({
  prompt,
  options: {
    hooks: hooks.hooks,
    // ...
  }
});
```

**Success Criteria:**
- Hooks execute at correct lifecycle points
- Can send to external services (analytics, APM)
- Errors in hooks don't crash agent

---

## Phase 6: Response Rendering (2-3 days)

### 6.1 Markdown to Slack Formatting

**Problem:** Agent responds in Markdown, Slack uses mrkdwn (different syntax)

**Solution:** Convert Agent markdown → Slack mrkdwn

**Implementation:**
```typescript
function convertToSlackMarkdown(markdown: string): string {
  return markdown
    // Code blocks: ```lang\ncode\n``` → ```code```
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '```$2```')
    // Bold: **text** or __text__ → *text*
    .replace(/(\*\*|__)(.*?)\1/g, '*$2*')
    // Italic: *text* or _text_ → _text_
    .replace(/(?<!\*)(\*)(?!\*)(.+?)\1/g, '_$2_')
    // Links: [text](url) → <url|text>
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>')
    // Headers: ## Text → *Text* (Slack doesn't support headers)
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')
    // Strikethrough: ~~text~~ → ~text~
    .replace(/~~(.+?)~~/g, '~$1~');
}

// In messageHandler.ts
await client.chat.update({
  channel: channelId,
  ts: messageTs,
  text: convertToSlackMarkdown(response)
});
```

**Success Criteria:**
- Code blocks render correctly
- Links are clickable
- Formatting matches Slack UX

---

### 6.2 File Attachments in Responses

**Use Case:** Agent generates a file → Upload to Slack

**Implementation:**
```typescript
// In queryClaudeAgent
for await (const message of result) {
  if (message.type === 'tool_result' && message.tool === 'Write') {
    // File was created
    const filePath = message.result.path;
    
    // Upload to Slack
    await context.client.files.upload({
      channels: context.channelId,
      file: fs.createReadStream(filePath),
      title: path.basename(filePath),
      thread_ts: context.threadTs,
    });
  }
}
```

**Success Criteria:**
- Generated files appear in Slack thread
- File names are descriptive
- Works for CSV, JSON, text, etc.

---

### 6.3 Create & Share Google Docs

**Use Case:** Generate long document → Create Google Doc → Share link

**Prerequisites:** Google Drive MCP server enabled

**Implementation:**
```typescript
// Agent generates content
const content = await queryClaudeAgent(
  "Write a comprehensive project proposal",
  sessionId
);

// Create Google Doc via MCP
const docUrl = await createGoogleDoc({
  title: 'Project Proposal',
  content: content.response,
});

// Share in Slack
await client.chat.postMessage({
  channel: channelId,
  thread_ts: threadTs,
  text: `📄 I've created a Google Doc: ${docUrl}`,
});
```

**Success Criteria:**
- Google Doc created with proper formatting
- Link is shareable
- User has edit access

---

## Implementation Priority

| Feature | Impact | Complexity | Dependencies | Priority |
|---------|--------|------------|--------------|----------|
| Enable Read tool | HIGH | LOW | None | **P0** |
| Permission mode 'ask' | HIGH | MEDIUM | Slack approval UI | **P1** |
| Enable Write tool | MEDIUM | LOW | Permission mode | **P1** |
| Enable Task tool | HIGH | MEDIUM | Read/Write | **P2** |
| Specialized agents | MEDIUM | LOW | Task tool | **P2** |
| MCP servers (basic) | HIGH | HIGH | External APIs | **P2** |
| Markdown conversion | MEDIUM | LOW | None | **P3** |
| Skills | MEDIUM | MEDIUM | Task tool | **P3** |
| Hooks | LOW | MEDIUM | None | **P3** |
| Dynamic MCP loading | MEDIUM | HIGH | MCP servers | **P4** |
| File attachments | MEDIUM | MEDIUM | Write tool | **P4** |
| Google Docs | LOW | HIGH | MCP + Drive API | **P5** |

---

## Tool Safety Matrix

| Tool | Risk Level | Mitigation | Recommended Mode |
|------|-----------|------------|------------------|
| Read | 🟢 LOW | Session dir isolation | bypassPermissions |
| Grep | 🟢 LOW | Same as Read | bypassPermissions |
| Write | 🟡 MEDIUM | Session dir only | ask |
| Edit | 🟡 MEDIUM | Session dir only | ask |
| Glob | 🟡 MEDIUM | Session dir only | ask |
| Task | 🟡 MEDIUM | Inherits parent mode | ask |
| Bash | 🔴 HIGH | Timeout + sandboxing | ask + approval |
| BashOutput | 🔴 HIGH | Same as Bash | ask + approval |

**Recommendation:** Start with Read/Grep in bypass mode, everything else in ask mode.

---

## Cost Considerations

### Token Usage Impact

| Feature | Token Overhead | Notes |
|---------|---------------|-------|
| Read tool | +500-5000 | Depends on file size |
| Sub-agents | +1000-10000 | Each sub-agent adds context |
| MCP servers | +200-2000 | Tool definitions |
| Skills | +100-500 | Prompt templates |

**Mitigation:**
- Set max file size for Read tool (100KB)
- Limit sub-agent depth (max 2 levels)
- Load MCP servers on-demand
- Cache skill prompts

---

## Testing Strategy

### Unit Tests
```typescript
describe('Agent SDK Integration', () => {
  it('should enable Read tool correctly', async () => {
    const result = await queryClaudeAgent('Read https://example.com');
    expect(result.response).toContain('content from example.com');
  });
  
  it('should request permission for Write', async () => {
    const approvalRequested = jest.fn();
    await queryClaudeAgent('Create a file', undefined, {
      onPermissionRequest: approvalRequested
    });
    expect(approvalRequested).toHaveBeenCalledWith({
      tool: 'Write',
      params: expect.any(Object)
    });
  });
});
```

### Integration Tests
```typescript
describe('Slack Integration', () => {
  it('should show permission approval UI', async () => {
    await sendMessage('@bot write a file');
    const messages = await getChannelMessages();
    expect(messages).toContainMatch(/Permission Request.*Write/);
  });
  
  it('should upload generated files to Slack', async () => {
    await sendMessage('@bot create a CSV report');
    await approvePermission();
    const files = await getChannelFiles();
    expect(files).toContainMatch(/\.csv$/);
  });
});
```

---

*Next: See 03_IMPLEMENTATION_PLAN.md for sequenced implementation steps*
