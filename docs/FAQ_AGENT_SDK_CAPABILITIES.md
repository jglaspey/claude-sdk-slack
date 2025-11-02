# FAQ: Agent SDK Capabilities

**Quick answers to your specific questions about what's possible**

---

## Slash Commands

### Q: Can I map a Slack slash command to an Agent SDK feature?

**A: Yes, absolutely!** 

You can route Slack slash commands to Agent SDK in several ways:

#### 1. Direct Query Mapping
```typescript
app.command('/ask', async ({ command, ack, respond }) => {
  await ack();
  
  // Send directly to Agent SDK
  const { response } = await queryClaudeAgent(command.text);
  
  await respond({ text: response });
});
```

#### 2. Tool-Specific Routing
```typescript
app.command('/summarize', async ({ command, ack, respond }) => {
  await ack();
  
  // Query with specific tools enabled
  const { response } = await queryClaudeAgent(
    `Summarize: ${command.text}`,
    undefined,
    { allowedTools: ['Read', 'WebFetch'] }
  );
  
  await respond({ text: response });
});
```

#### 3. Sub-Agent Routing
```typescript
app.command('/research', async ({ command, ack, respond }) => {
  await ack();
  
  // Use Task tool for research sub-agent
  const { response } = await queryClaudeAgent(
    `Research this topic: ${command.text}`,
    undefined,
    { allowedTools: ['Task', 'Read', 'WebFetch'] }
  );
  
  await respond({ text: response });
});
```

**Limitations:**
- Slack requires response within 3 seconds (use deferred responses for long queries)
- Commands are workspace-wide (can't scope to specific channels without custom logic)

**Recommended Slash Commands:**
- `/ask <question>` - One-shot query
- `/research <topic>` - Multi-step research
- `/summarize <url>` - Summarize URL/file
- `/agent <name> <prompt>` - Route to specialized agent

---

## Agents and Sub-Agents

### Q: Can I use agents and sub-agents?

**A: Yes! Using the Task tool.**

#### Main Agent → Sub-Agent Pattern
```typescript
// Main agent config
const { response } = await queryClaudeAgent(
  "Research 3 competitors and compare pricing",
  sessionId,
  {
    allowedTools: ['Task', 'Read', 'WebFetch'],
    permissionMode: 'ask',
  }
);

// Agent SDK will automatically:
// 1. Create sub-agents for parallel research
// 2. Each sub-agent uses Read/WebFetch
// 3. Parent synthesizes results
```

#### Specialized Agent Definitions
Create agent configs in `.claude/agents/`:

```json
// .claude/agents/sql-helper.json
{
  "name": "SQL Helper",
  "description": "Expert SQL query assistant",
  "systemPrompt": "You are a SQL expert. Write safe, efficient queries.",
  "allowedTools": ["Read", "Grep"],
  "permissionMode": "bypassPermissions"
}
```

Route to them via command:
```typescript
app.command('/agent', async ({ command }) => {
  const [agentName, ...prompt] = command.text.split(' ');
  const config = await loadAgentConfig(agentName);
  
  const { response } = await queryClaudeAgent(
    prompt.join(' '),
    undefined,
    config
  );
});
```

**Use Cases:**
- **Parallel research:** Multiple sub-agents research different topics
- **Specialized workflows:** Route to expert agents (SQL, code review, etc.)
- **Multi-step tasks:** Break complex tasks into sub-tasks

**Considerations:**
- Each sub-agent adds context (token cost)
- Sub-agents inherit parent's permission mode
- Can set max depth to prevent recursion

---

## Response Rendering

### Q: What considerations for how Agent SDK responses are rendered in Slack?

**A: Several formatting and UX considerations:**

#### 1. Markdown Conversion
Agent SDK returns markdown, Slack uses "mrkdwn" (different syntax):

```typescript
function convertToSlackMarkdown(markdown: string): string {
  return markdown
    // Code blocks: Remove language specifier
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '```$2```')
    // Bold: **text** → *text*
    .replace(/\*\*(.*?)\*\*/g, '*$1*')
    // Italic: _text_ → _text_ (same)
    // Links: [text](url) → <url|text>
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>')
    // Headers: ## Text → *Text* (Slack has no headers)
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*');
}
```

#### 2. Block Kit for Rich UI
Use Slack's Block Kit instead of plain text:

```typescript
await client.chat.postMessage({
  channel: channelId,
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: convertToSlackMarkdown(response)
      }
    },
    {
      type: 'actions',
      elements: [
        { type: 'button', text: { type: 'plain_text', text: 'Regenerate' } },
        { type: 'button', text: { type: 'plain_text', text: 'Expand' } }
      ]
    }
  ],
  text: response // Fallback for notifications
});
```

#### 3. Progressive Updates
Stream partial responses as they arrive:

```typescript
let accumulated = '';
let lastUpdate = Date.now();

for await (const message of result) {
  if (message.type === 'assistant') {
    accumulated += extractText(message);
    
    // Update every 3 seconds
    if (Date.now() - lastUpdate > 3000) {
      await client.chat.update({
        channel: channelId,
        ts: messageTs,
        text: accumulated + '\n\n🔄 _Still thinking..._'
      });
      lastUpdate = Date.now();
    }
  }
}
```

#### 4. Length Limits
Slack messages max at ~40,000 characters:

```typescript
if (response.length > 40000) {
  // Option 1: Truncate
  response = response.substring(0, 39900) + '\n\n_[Truncated]_';
  
  // Option 2: Upload as file
  await client.files.upload({
    channels: channelId,
    content: response,
    filename: 'full-response.txt',
    title: 'Full Response',
  });
  response = '_Response too long, uploaded as file above._';
}
```

**Recommendations:**
- Use Block Kit for all responses (better UX)
- Convert markdown carefully (test edge cases)
- Stream long responses progressively
- Truncate or file-upload very long responses
- Add action buttons for common follow-ups

---

## File Attachments

### Q: Can I return attached files?

**A: Yes, in two ways:**

#### 1. Agent Generates File → Upload to Slack

When Agent SDK creates a file using Write tool:

```typescript
// Agent SDK creates file
for await (const message of result) {
  if (message.type === 'tool_result' && message.tool === 'Write') {
    const filePath = message.result.path;
    
    // Upload to Slack
    await client.files.upload({
      channels: channelId,
      file: fs.createReadStream(filePath),
      title: path.basename(filePath),
      thread_ts: threadTs,
    });
  }
}
```

**Use Cases:**
- CSV reports
- Generated code files
- Data exports
- Configuration files

#### 2. Create & Share External Files

Create file in Google Drive/Docs, share link:

```typescript
// Via MCP Google Drive server
const { response } = await queryClaudeAgent(
  "Create a comprehensive report",
  sessionId,
  { mcpServers: ['google-drive'] }
);

// Agent SDK creates Google Doc via MCP
// Returns: "I've created a Google Doc: https://docs.google.com/..."

// Parse link and post
const docLink = extractLink(response);
await client.chat.postMessage({
  channel: channelId,
  text: `📄 Report ready: ${docLink}`,
});
```

**File Type Support:**
- **Text files:** Direct upload (txt, md, csv, json)
- **Binary files:** Base64 encode or stream
- **Large files:** Use external storage (Drive, S3) + share link

**Limitations:**
- Slack file size limit: 1GB (free) or 20GB (paid)
- Agent SDK Write tool limited to session directory
- Binary files require encoding

---

## Google Docs Integration

### Q: Can I make a markdown or Google file and send the link?

**A: Yes, using MCP Google Drive server!**

#### Setup
```typescript
// Initialize MCP client
import { createMCPClient } from '@anthropic-ai/claude-agent-sdk';

const googleDriveMCP = await createMCPClient({
  server: 'google-drive',
  config: {
    credentials: process.env.GOOGLE_CREDENTIALS_PATH,
  }
});
```

#### Create Document
```typescript
const { response } = await queryClaudeAgent(
  "Write a project proposal and save it to Google Docs",
  sessionId,
  {
    mcpClients: [googleDriveMCP],
    allowedTools: ['Task', 'Read', 'Write'],
  }
);

// Agent SDK will:
// 1. Generate content
// 2. Use MCP to create Google Doc
// 3. Return shareable link
```

#### Workflow
```
User: "Create a meeting agenda for tomorrow"
  ↓
Agent generates content
  ↓
Agent creates Google Doc via MCP
  ↓
Agent returns: "Created: https://docs.google.com/..."
  ↓
Bot posts link in Slack
```

#### Permissions Needed
- Google Cloud project with Drive API enabled
- Service account credentials
- OAuth consent for user access

**Alternative:** Create markdown, upload to Slack as file:
```typescript
const markdown = await queryClaudeAgent("Generate meeting notes");
await client.files.upload({
  channels: channelId,
  content: markdown.response,
  filename: 'meeting-notes.md',
  filetype: 'markdown',
});
```

---

## MCP Servers

### Q: Can I get an MCP server to work?

**A: Yes! MCP servers extend Agent SDK with external integrations.**

#### Available MCP Servers
- **Web search** (Brave, Google)
- **GitHub** (repos, PRs, issues)
- **Google Drive** (docs, sheets, search)
- **Notion** (pages, databases)
- **Database** (Postgres, MySQL)
- **Custom** (build your own)

#### Basic Setup
```typescript
import { createMCPClient } from '@anthropic-ai/claude-agent-sdk';

// Initialize MCP servers
const mcpClients = await Promise.all([
  createMCPClient({
    server: 'github',
    config: { token: process.env.GITHUB_TOKEN }
  }),
  createMCPClient({
    server: 'web-search',
    config: { apiKey: process.env.BRAVE_API_KEY }
  }),
]);

// Use in query
const { response } = await queryClaudeAgent(
  "Search GitHub for Agent SDK examples",
  sessionId,
  { mcpClients }
);
```

#### Configuration
```bash
# In .env
GITHUB_TOKEN=ghp_xxxxx
BRAVE_API_KEY=xxxxx
GOOGLE_CREDENTIALS=/path/to/credentials.json
```

**Use Cases:**
- Search web for latest info
- Read GitHub repo/PR content
- Query internal databases
- Access Google Workspace
- Custom API integrations

---

### Q: Can I load MCP servers dynamically with a sub-agent?

**A: Yes! This saves context window.**

#### Problem
Loading all MCPs upfront consumes tokens (each MCP adds tool definitions).

#### Solution
Load MCPs on-demand based on query intent:

```typescript
async function queryWithDynamicMCP(prompt: string, sessionId?: string) {
  // Analyze prompt to detect needed MCPs
  const neededMCPs = detectRequiredMCPs(prompt);
  
  // Only initialize what's needed
  const mcpClients = await Promise.all(
    neededMCPs.map(name => createMCPClient({ server: name }))
  );
  
  return await queryClaudeAgent(prompt, sessionId, { mcpClients });
}

function detectRequiredMCPs(prompt: string): string[] {
  const mcps: string[] = [];
  
  if (/github|repo|pr|issue/i.test(prompt)) {
    mcps.push('github');
  }
  if (/search|google|find online/i.test(prompt)) {
    mcps.push('web-search');
  }
  if (/drive|docs|sheets/i.test(prompt)) {
    mcps.push('google-drive');
  }
  
  return mcps;
}
```

#### Sub-Agent Pattern
```typescript
// Main agent spawns sub-agent with specific MCP
const { response } = await queryClaudeAgent(
  "Research this GitHub repo: owner/name",
  sessionId,
  {
    allowedTools: ['Task'],
    onTaskCreate: async (task) => {
      // Sub-agent gets GitHub MCP only
      return {
        mcpClients: [await createMCPClient({ server: 'github' })]
      };
    }
  }
);
```

**Benefits:**
- Reduce token usage (only relevant tools in context)
- Faster initialization (don't load unused MCPs)
- Isolated permissions (sub-agents get scoped access)

**Considerations:**
- Intent detection may miss edge cases
- MCP initialization has latency
- Need error handling if MCP unavailable

---

## Skills

### Q: Can I get Skills to work?

**A: Yes! Skills are pre-defined workflows.**

#### What Are Skills?
Reusable prompt templates + tool configurations for common tasks.

#### Create a Skill
```json
// .claude/skills/meeting-notes.json
{
  "name": "meeting-notes",
  "description": "Structure raw meeting notes",
  "prompt": "Convert these notes into structured format with:\n- Date & attendees\n- Key topics\n- Action items\n- Decisions made\n\nNotes: {{CONTENT}}",
  "requiredTools": ["Read"],
  "examples": [
    {
      "input": "Met with John, discussed Q1 goals...",
      "output": "**Meeting Summary**\nDate: {{DATE}}..."
    }
  ]
}
```

#### Use a Skill
```typescript
// Auto-detection
const { response } = await queryClaudeAgent(
  "Help me organize these meeting notes: [notes]",
  sessionId
);
// Agent SDK detects "meeting-notes" skill and applies template

// Explicit invocation
const skill = await loadSkill('meeting-notes');
const { response } = await queryClaudeAgent(
  skill.prompt.replace('{{CONTENT}}', userInput),
  sessionId,
  { allowedTools: skill.requiredTools }
);
```

#### Useful Skills for Slack Bot
1. **Meeting notes** - Structure standup/meeting notes
2. **PR review** - Generate code review template
3. **Incident response** - Guide through incident workflow
4. **Email draft** - Generate professional emails
5. **Bug report** - Format bug reports consistently

#### Slash Command Integration
```typescript
app.command('/skill', async ({ command, ack, respond }) => {
  await ack();
  
  // Parse: /skill meeting-notes <content>
  const [skillName, ...content] = command.text.split(' ');
  
  const skill = await loadSkill(skillName);
  const prompt = skill.prompt.replace('{{CONTENT}}', content.join(' '));
  
  const { response } = await queryClaudeAgent(prompt);
  await respond({ text: response });
});
```

**Benefits:**
- Consistent outputs for common tasks
- Easy to share across team
- Can be version controlled
- Reduce prompt engineering per user

---

## Hooks

### Q: Can I get hooks to work?

**A: Yes! Hooks run at lifecycle events.**

#### What Are Hooks?
Custom code that executes at specific points in the agent lifecycle.

#### Available Hooks
- `onStart` - Session begins
- `onComplete` - Session ends (with results)
- `onError` - Error occurs
- `onToolUse` - Tool is called
- `onMessage` - Each message exchanged

#### Implement Hooks
```typescript
// .claude/hooks/analytics.ts
export const hooks = {
  onStart: async (session) => {
    console.log(`[Analytics] Session started: ${session.id}`);
    await analytics.track('agent_session_start', {
      userId: session.metadata.userId,
      channelId: session.metadata.channelId,
    });
  },
  
  onComplete: async (session, result) => {
    console.log(`[Analytics] Complete - Cost: $${result.total_cost_usd}`);
    
    // Track usage
    await usageTracker.record({
      sessionId: session.id,
      userId: session.metadata.userId,
      turns: result.num_turns,
      cost: result.total_cost_usd,
      tokens: result.total_tokens,
    });
  },
  
  onError: async (session, error) => {
    console.error(`[Error] ${session.id}:`, error);
    
    // Send to Sentry
    await sentry.captureException(error, {
      tags: { sessionId: session.id }
    });
    
    // Alert in Slack
    if (error.critical) {
      await adminAlert(`Critical error in session ${session.id}`);
    }
  },
  
  onToolUse: async (session, tool, params) => {
    console.log(`[Audit] Tool: ${tool}`, params);
    
    // Audit log for compliance
    await auditLog.record({
      sessionId: session.id,
      userId: session.metadata.userId,
      tool,
      params,
      timestamp: Date.now(),
    });
  }
};
```

#### Load Hooks
```typescript
// In claudeAgent.ts
const hooks = await import('./.claude/hooks/analytics.js');

const { response } = await query({
  prompt,
  options: {
    hooks: hooks.hooks,
    // ... other options
  }
});
```

#### Use Cases for Slack Bot
1. **Cost tracking** - onComplete records usage
2. **Error monitoring** - onError sends to Sentry/Datadog
3. **Audit logging** - onToolUse logs all tool usage
4. **User analytics** - onStart/onComplete track engagement
5. **Admin alerts** - onError sends critical alerts to admin channel

**Example: Cost Alert**
```typescript
onComplete: async (session, result) => {
  if (result.total_cost_usd > 1.00) {
    await client.chat.postMessage({
      channel: ADMIN_CHANNEL,
      text: `⚠️ Expensive query: $${result.total_cost_usd} in session ${session.id}`
    });
  }
}
```

---

## Summary Table

| Feature | Possible? | Difficulty | Prerequisites |
|---------|-----------|------------|---------------|
| Slash commands | ✅ Yes | Easy | None |
| Agents & sub-agents | ✅ Yes | Medium | Task tool enabled |
| Custom response rendering | ✅ Yes | Easy | Block Kit knowledge |
| File attachments | ✅ Yes | Medium | Write tool enabled |
| Google Docs creation | ✅ Yes | Hard | MCP + Google API |
| MCP servers | ✅ Yes | Medium | API credentials |
| Dynamic MCP loading | ✅ Yes | Hard | MCP + sub-agents |
| Skills | ✅ Yes | Easy | Agent SDK config |
| Hooks | ✅ Yes | Medium | Agent SDK config |

---

## Next Steps

1. **Start simple:** Slash commands + basic rendering (Sprint 1)
2. **Enable tools:** Read tool first (Sprint 2)
3. **Add interactivity:** Block Kit + buttons (Sprint 5)
4. **Advanced features:** Sub-agents, MCP, skills (later sprints)

Each feature builds on previous ones. Follow the Implementation Plan for sequencing.

---

*For detailed implementation, see the roadmap documents.*
