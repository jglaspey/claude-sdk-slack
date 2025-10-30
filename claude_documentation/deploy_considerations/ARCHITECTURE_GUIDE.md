# Buyer List Builder - Architecture Guide

> A comprehensive guide to understanding the architecture, deployment options, and scaling strategies for the Buyer List Builder system.

**Last Updated:** October 30, 2025

---

## Table of Contents

1. [Understanding the Claude Agent SDK](#understanding-the-claude-agent-sdk)
2. [Agent SDK vs. Direct API Usage](#agent-sdk-vs-direct-api-usage)
3. [Session Management & State](#session-management--state)
4. [Deployment Implications](#deployment-implications)
5. [Architecture Evolution Path](#architecture-evolution-path)
6. [Container Strategies](#container-strategies)
7. [Decision Framework](#decision-framework)

---

## Understanding the Claude Agent SDK

### What is the Claude Agent SDK?

The Claude Agent SDK is a **programmable runtime** that transforms Claude from an interactive tool into infrastructure you can build on. It's built on top of the same harness that powers Claude Code.

### Key Capabilities

```python
from claude_agent_sdk import query, ClaudeAgentOptions

# Autonomous agent with tools
async for message in query(
    prompt="Find companies in the SaaS industry",
    options=ClaudeAgentOptions(
        permission_mode='bypassPermissions',
        allowed_tools=['WebSearch', 'Read', 'Write']
    )
):
    # Claude autonomously uses tools to complete the task
    print(message)
```

**What makes it different:**
- **Context Management**: Automatic compaction and context management
- **Rich Tool Ecosystem**: File operations, code execution, web search, MCP extensibility
- **Advanced Permissions**: Fine-grained control over agent capabilities
- **Production Essentials**: Built-in error handling, session management, and monitoring
- **Optimized Integration**: Automatic prompt caching and performance optimizations

---

## Agent SDK vs. Direct API Usage

### The Fundamental Difference

| Aspect | Anthropic API (Direct) | Claude Agent SDK |
|--------|----------------------|------------------|
| **Architecture** | Request-response API | Agentic runtime with tools |
| **Tool Access** | None | WebSearch, Bash, File ops, MCP |
| **Session Management** | Manual (you manage history) | Automatic (SDK manages state) |
| **Execution Model** | Single API call | Multi-turn autonomous loops |
| **Use Case** | Simple Q&A, text generation | Complex workflows, research, automation |
| **Deployment** | Any environment | Requires Claude CLI binary |
| **State Storage** | Your application | Local filesystem (`~/.claude/sessions/`) |

### Stage 1 vs. Stage 3 Example

**Stage 1: Simple Analysis (Anthropic SDK)**
```python
from anthropic import Anthropic

client = Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

# Single request-response
message = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=2000,
    messages=[{"role": "user", "content": prompt}]
)

response_text = message.content[0].text
# Parse JSON and save results
```

**Why this works:** Stage 1 just needs Claude to analyze business data and return structured JSON. No tools needed.

**Stage 3: Autonomous Research (Agent SDK)**
```python
from claude_agent_sdk import query, ClaudeAgentOptions

# Multi-turn autonomous workflow
async for message in query(
    prompt="Find companies in Strategic Buyers category",
    options=ClaudeAgentOptions(
        permission_mode='bypassPermissions',
        allowed_tools=['WebSearch']
    )
):
    # Claude autonomously:
    # 1. Searches for trade associations
    # 2. Follows links to member directories
    # 3. Searches for industry conferences
    # 4. Aggregates company lists
    # 5. Returns structured results
    if hasattr(message, 'content'):
        for block in message.content:
            if hasattr(block, 'text'):
                results.append(block.text)
```

**Why Agent SDK is needed:** Stage 3 requires Claude to autonomously conduct web searches, follow links, and aggregate data across multiple sources.

### The Paradigm Shift

The Agent SDK represents a shift from **"AI as a chatbot"** to **"AI as programmable infrastructure"**.

**Analogy:**
- **Chrome Browser** (Claude Code) vs. **Puppeteer** (Agent SDK)
- **VS Code** (Claude Code) vs. **Language Server Protocol** (Agent SDK)
- **Postman** (Claude Code) vs. **HTTP Client Library** (Agent SDK)

---

## Session Management & State

### How Sessions Work

#### Anthropic API (No Built-in Sessions)
```python
# You must manually maintain conversation history
conversation_history = []

# First message
conversation_history.append({"role": "user", "content": "What's 2+2?"})
response1 = client.messages.create(messages=conversation_history)
conversation_history.append({"role": "assistant", "content": response1.content[0].text})

# Second message - you pass full history
conversation_history.append({"role": "user", "content": "What did I just ask?"})
response2 = client.messages.create(messages=conversation_history)
```

#### Agent SDK (Automatic Session Management)
```python
# First interaction - SDK creates session
session_id = None
async for msg in query(prompt="What's 2+2?"):
    if msg.subtype == 'init':
        session_id = msg.data['session_id']  # e.g., "session-abc123"

# Later - resume with full context
async for msg in query(
    prompt="What did I just ask?",
    options=ClaudeAgentOptions(resume=session_id)
):
    # Claude remembers the previous conversation automatically
    print(msg)
```

### Where Are Sessions Stored?

**Critical Understanding:** The Agent SDK stores sessions on the **local filesystem**:

```
~/.claude/sessions/
├── session-abc123/
│   ├── conversation.json    ← Full conversation history
│   ├── context.json         ← Context and state
│   └── files/               ← Any files created/modified
└── session-xyz789/
    └── ...
```

---

## Deployment Implications

### Current Architecture (Local Development)

```
Your Mac
├── Python App (buyer-list-builder)
├── Claude CLI Binary (/Users/justinkistner/.claude/local)
├── Session Storage (~/.claude/sessions/)
├── Client Data (data/outputs/)
└── API Key (for LLM calls)
```

**Works perfectly for:**
- ✅ Local development
- ✅ Single-machine workflows
- ✅ Manual pipeline execution
- ✅ Prototyping and experimentation

**Limitations:**
- ❌ Tied to your specific machine
- ❌ Can't scale horizontally
- ❌ Sessions not portable across machines
- ❌ Hardcoded path: `/Users/justinkistner/.claude/local`

### Deployment Scenarios

#### ✅ Scenario 1: Single Server (Works)
All requests hit same server with persistent session storage.

#### ❌ Scenario 2: Load Balanced Servers (Breaks)
User creates session on Server A, next request routes to Server B, session not found.

**Solutions:**
- Sticky sessions (session affinity)
- Shared filesystem (NFS/EFS)
- Manual session management in database

#### ❌ Scenario 3: Containers (Breaks Without Volumes)
Container restarts = all sessions lost.

**Solution:** Mount persistent volumes for session storage.

---

## Architecture Evolution Path

### Phase 1: Current State (Perfect for Now)

**Scale:** 1-5 clients, manual execution

```bash
python stage_1_identify_buyer_types.py cim.yaml
python stage_2_generate_seed_companies.py cim.yaml
python stage_3_web_search_expansion_parallel.py cim.yaml
```

**Verdict:** ✅ **Don't change anything. This is appropriately engineered.**

### Phase 2: Simple CLI (5-10 Clients)

Add a CLI tool for easier pipeline management.

### Phase 3: Static Reports (10-20 Clients)

Generate HTML reports that clients can view.

### Phase 4: Simple Web Dashboard (20+ Clients)

Add a Flask/FastAPI dashboard for multi-user access.

### Phase 5: Container Architecture (SaaS Scale)

**Only add when:**
- Running 5+ pipelines simultaneously
- Need to deploy to production servers
- Multiple users triggering pipelines
- Need isolation between clients

---

## Container Strategies

### Strategy 1: Per-Client Session Storage (Recommended)

Store Claude sessions alongside client data:

```
data/outputs/cranbury_and_dunwell/
├── buyers.db
├── *.json
├── traces/
└── .claude_sessions/           ← NEW
    ├── session-abc/
    └── session-def/
```

**Benefits:**
- Sessions tied to client workflow
- Container can be ephemeral
- Natural lifecycle management
- Works locally AND in containers

### Strategy 2: Container-Per-Client (Advanced)

Complete isolation with one container per client.

**When to use:** Need to run multiple pipelines simultaneously with complete isolation.

### Strategy 3: Shared Filesystem (Multi-Server)

Use NFS/EFS for shared session storage across servers.

**Trade-offs:** Network overhead, complexity, single point of failure.

---

## Decision Framework

### When to Use Agent SDK vs. Direct API

**Use Agent SDK when:**
- ✅ Need autonomous tool use (WebSearch, Bash, file operations)
- ✅ Multi-turn workflows with complex decision trees
- ✅ Research and data aggregation tasks

**Use Direct API when:**
- ✅ Simple request-response patterns
- ✅ Text generation, analysis, classification
- ✅ Need maximum portability

### When to Add Infrastructure

| Infrastructure | Add When |
|----------------|----------|
| **CLI Tool** | 5+ clients, running pipelines regularly |
| **Static Reports** | Clients need results without accessing your machine |
| **Web Dashboard** | 20+ clients OR multiple simultaneous users |
| **Containers** | Need production deployment OR multiple simultaneous pipelines |

### Red Flags for Over-Engineering

- ❌ Building infrastructure before you have 10 clients
- ❌ Adding containers when you run pipelines manually
- ❌ Creating APIs that only you will use
- ❌ Spending more time on infrastructure than improving results

---

## Key Takeaways

1. **The Agent SDK is a Platform, Not Just an API** - It transforms Claude into programmable infrastructure

2. **Sessions Are Stored Locally** - Requires persistent volumes for containers and lifecycle management

3. **Start Simple, Scale Incrementally** - Don't build infrastructure before you need it

4. **YAGNI Applies to AI Infrastructure Too** - Focus on value, not premature optimization

5. **Prioritize Results Over Infrastructure** - Better pipeline results > fancy architecture

---

## Quick Reference

### Current Setup (Phase 1)
```bash
# Local execution
python stage_3_web_search_expansion_parallel.py cim.yaml --workers 8
```

### When You Need More (Phase 2+)
```bash
# CLI tool
python cli.py run-pipeline client_name

# Static reports
python generate_reports.py

# Web dashboard
python app.py  # http://localhost:5000
```

### Container Deployment (Phase 5)
```bash
# Docker with persistent storage
docker run -v $(pwd)/data/outputs:/app/data buyer-list-builder
```

---

For detailed code examples and implementation guides, see the companion documents:
- `DEPLOYMENT_GUIDE.md` - Container and production deployment
- `SESSION_MANAGEMENT.md` - Advanced session handling
- `SCALING_GUIDE.md` - When and how to scale
