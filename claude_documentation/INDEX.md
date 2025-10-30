# Claude Documentation Index

Documentation copied from `justinkistner/ai-sop/claude_documentation`

## Directory Structure

### 📁 claude_agent_sdk/
Build custom AI agents with the Claude Agent SDK (formerly Claude Code SDK):
- `overview.md` - SDK installation, capabilities (context management, tool ecosystem, permissions, monitoring), use cases (coding agents, data agents, workflow automation)
- `python_sdk.md` - Python SDK reference and implementation guide
- `typescript_sdk.md` - TypeScript/Node.js SDK reference and implementation guide
- **guides/** - Comprehensive implementation guides:
  - `custom_tools.md` - Creating custom tools for agents
  - `handling_permissions.md` - Fine-grained permission control
  - `hosting_the_agent_sdk.md` - Deployment and hosting strategies
  - `mcp_in_the_sdk.md` - Model Context Protocol integration
  - `modifying_system_prompts.md` - Customizing agent behavior
  - `session_management.md` - Managing agent sessions
  - `slash_commands_in_the_sdk.md` - Implementing slash commands
  - `streaming_input.md` - Streaming vs single mode input
  - `subagents.md` - Creating and managing subagents
  - `todo_lists.md` - Task tracking and management
  - `tracking_costs_and_usage.md` - Monitoring API costs and usage

### 📁 claude_code/
Claude Code configuration, customization, and advanced features:
- `claude_md_overview.md` - CLAUDE.md files for project context, bash commands, code style, workflow documentation, and prompt optimization
- `configuring_settings.md` - Settings hierarchy (user/project/enterprise), permissions configuration, environment variables, managed policies
- `hooks_reference.md` - Lifecycle hooks for customizing Claude Code behavior
- `manage_claudes_memory.md` - Memory management and context optimization
- `plugin_marketplace.md` - Installing and managing plugins from the marketplace
- `plugins_reference.md` - Plugin development and API reference
- `slash_commands_reference.md` - Complete reference of built-in slash commands

### 📁 claude_skills/
- `agent_skills_quickstart.md` - Getting started with agent skills
- `agent_skills_best_practices.md` - Best practices for skills
- `using_skills.md` - How to use skills
- `example_skills.md` - Example skill implementations
- `skills_management/` - CRUD operations for skills

### 📁 community_insights/
Community learnings and best practices:
- `thought_leaders_list.md` - Key people in the Claude community
- `superpowers_october_2025.md` - Jesse Vincent's (obra) plugin system for Claude Code featuring Skills, TDD workflows, git worktrees, subagent testing, persuasion principles (Cialdini), memory systems, and the brainstorm→plan→implement methodology
- `skills_for_claude.md` - Anthropic's official Skills system release and Superpowers integration with MCP creation
- `obra_claude_dotfile.md` - Comprehensive CLAUDE.md configuration covering TDD, systematic debugging, naming conventions, git safety, test-driven development, and relationship dynamics between human and AI
- `vibe_engineering_simon_willison.md` - Professional AI-assisted development practices: automated testing, planning, documentation, version control, code review culture, QA, and the distinction from "vibe coding"
- `steipete_agent_rules.md` - Strict git safety rules for multi-agent environments: atomic commits, coordination protocols, destructive operation prevention
- `writing_skills_tdd_approach.md` - TDD methodology applied to documentation: RED-GREEN-REFACTOR for skills, pressure testing with subagents, Claude Search Optimization (CSO), token efficiency
- `just-talk-to-it.md` - Peter Steinberger's workflow with GPT-5-Codex: parallel agents (3-8 terminals), blast radius thinking, refactoring cycles, spec-driven vs iterative development, avoiding tool charade
- `designing_agentic_loops.md` - Simon Willison on YOLO mode safety, sandboxing strategies, tool selection, tightly scoped credentials, clear success criteria, and when to design agentic loops
- `reference_analysis.md` - Comprehensive catalog of external references: tools (Codex CLI, Gemini CLI, Cursor, Amplifier), thought leaders, organizations, coined terms, and ecosystem patterns
- `coding_agents_september_2025.md` - Jesse Vincent's git worktree workflows, brainstorming prompts, and planning processes for Claude Code
- `agent_file_structure_learnings.md` - Critical agent file structure requirements: name field for discoverability, description with examples, color field, tools vs inheritance, model selection, and testing agent discovery

## Usage

This documentation can help guide:
1. AI-assisted software development workflows
2. Best practices for Claude Code integration
3. Skills development for domain-specific workflows
4. Community-tested patterns and approaches

## Applying These Insights

Consider using these concepts for:
- Creating skills for common domain-specific patterns
- Implementing agentic loops for complex analysis tasks
- Following best practices for confidence scoring and validation
- Applying TDD approach to model improvements and classification tasks
