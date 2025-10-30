# Reference Analysis: External Links & Citations

**Created:** 2025-10-17  
**Purpose:** Comprehensive analysis of all external references, tools, projects, and authors cited in community_insights documentation

---

## Summary

This document catalogs all external references found in the community_insights folder to identify additional thought leaders, tools, and projects in the AI-assisted development ecosystem.

---

## Tools & Products Referenced

### Coding Agents & IDEs

#### OpenAI Codex CLI
- **Official Docs:** https://developers.openai.com/codex/cli/
- **GitHub:** https://github.com/openai/codex
- **Launch:** April 2025
- **Description:** Lightweight coding agent that runs in terminal
- **Key Features:**
  - Cloud-based software engineering agent
  - Works on many tasks across codebases
  - Seamless switching between real-time collaboration and async delegation
  - Available to ChatGPT Plus users
- **Referenced by:** Simon Willison in "Vibe Engineering"
- **Status:** Available to ChatGPT Plus, Pro, Business, Edu, and Enterprise plans

#### Google Gemini CLI
- **GitHub:** https://github.com/google-gemini/gemini-cli
- **Launch:** June 2025
- **Description:** Open-source AI agent that brings Gemini directly into your terminal
- **Key Features:**
  - Code understanding & generation
  - Automation & integration
  - GitHub integration
  - MCP server support
  - 333+ contributors, 123 releases
- **Referenced by:** Simon Willison in "Vibe Engineering"
- **Notable:** Very active development with large contributor base

#### Cursor
- **Website:** https://cursor.com/
- **Description:** AI-powered code editor (VS Code fork)
- **Key Features:**
  - Fast autocomplete
  - Bring-your-own-model support
  - Integration with OpenAI, Anthropic, Gemini, xAI
  - Local control and privacy focus
- **Referenced by:** Peter Steinberger in "Agent Rules for Git"
- **Note:** Distinguished as different from "Codex Web" in steipete's documentation

#### Claude Code
- **Developer:** Anthropic
- **Plugin System Docs:** https://docs.claude.com/en/docs/claude-code/plugins
- **Launch:** February 2025 (initial), October 2025 (plugin system)
- **Key Features:**
  - Official Skills system (launched Oct 2025)
  - Plugin architecture
  - Native integration with Superpowers
- **Referenced by:** All authors extensively

#### Zed
- **Blog:** https://zed.dev/blog
- **Key Innovation:** Agentic Engineering Sessions
- **Notable Content:**
  - Mitchell Hashimoto session on agentic engineering
  - ACP protocol (alternative to MCP)
  - IDE innovations for AI-assisted development
- **Referenced by:** Mitchell Hashimoto collaboration
- **ACP Protocol:** Newer protocol trying to improve on MCP for AI tooling in IDEs

### Frameworks & Systems

#### Microsoft Amplifier
- **GitHub:** https://github.com/microsoft/amplifier
- **Description:** Coordinated and accelerated development system with specialized AI agents
- **Status:** Research demonstrator, early development
- **Key Features:**
  - 20+ specialized agents (architecture, debugging, security, etc.)
  - Pre-loaded context with proven patterns
  - Parallel worktree system
  - Knowledge extraction system
  - Conversation transcripts with auto-export
  - Automation tools for quality checks
- **Referenced by:** Jesse Vincent (obra) - influenced Superpowers skills development
- **Integration:** Works with Claude Code
- **Philosophy:** "I have more ideas than time to try them out"

#### obra's Superpowers
- **GitHub Marketplace:** https://github.com/obra/superpowers-marketplace
- **Skills Repository:** https://github.com/obra/superpowers-skills
- **Description:** Plugin marketplace and skills system for Claude Code
- **Components:**
  - Bootstrap for loading SKILL.md files
  - Architect/Implementer methodology
  - TDD-based workflow system
  - Skills adapted from Microsoft Amplifier
- **Referenced by:** Multiple thought leaders, 14+ forks identified

#### Model Context Protocol (MCP)
- **Description:** Protocol for connecting AI systems with external tools and data sources
- **Developer:** Anthropic
- **Referenced by:** 
  - Jesse Vincent (obra) - mentions "creating MCPs" skill
  - Multiple references in naming conventions (obra's CLAUDE.md warns against "MCPWrapper" naming)
- **Alternative:** ACP protocol from Zed team

---

## Personal Websites & Blogs Referenced

### Primary Blogs (Already Documented)

#### Jesse Vincent (obra)
- **Primary Blog:** https://blog.fsck.com
- **Website:** http://fsck.com
- **Dotfiles:** https://github.com/obra/dotfiles
- **Specific Posts Referenced:**
  - https://blog.fsck.com/2025/10/09/superpowers/
  - https://blog.fsck.com/2025/10/05/how-im-using-coding-agents-in-september-2025/
  - https://blog.fsck.com/2025/10/16/skills-for-claude/

#### Simon Willison
- **Primary Blog:** https://simonwillison.net
- **TIL Blog:** https://til.simonwillison.net
- **Tools Collection:** https://tools.simonwillison.net
- **Specific Posts Referenced:**
  - https://simonwillison.net/2025/Oct/7/vibe-engineering/
  - https://simonwillison.net/2025/Oct/5/parallel-coding-agents/
  - https://simonwillison.net/2025/Sep/4/highlighted-tools/
  - https://til.simonwillison.net/git/git-bisect

#### Peter Steinberger (steipete)
- **Blog:** https://steipete.me
- **Gist:** https://gist.github.com/steipete/d3b9db3fa8eb1d1a692b7656217d8655
- **Specific Posts Referenced:**
  - https://steipete.me/posts/2025/claude-code-is-my-computer
  - https://steipete.me/posts/2025/vibetunnel
  - https://steipete.me/posts/2025/when-ai-meets-madness-peters-16-hour-days
  - https://steipete.me/posts/2025/stop-overthinking-ai-subscriptions
  - https://steipete.me/posts/2025/finding-my-spark-again

### Additional Blogs/Resources Mentioned

#### Gergely Orosz - The Pragmatic Engineer
- **Newsletter:** https://newsletter.pragmaticengineer.com
- **Specific Content:**
  - https://newsletter.pragmaticengineer.com/p/software-engineering-with-llms-in-2025
  - https://newsletter.pragmaticengineer.com/p/the-pulse-149-new-trend-programming
- **Referenced by:** Peter Steinberger, Simon Willison
- **Notable Quote:** "Working with multiple AI agents comes very natural to most senior+ engineers or tech leads who worked at a large company"

#### Mitchell Hashimoto
- **Website:** https://mitchellh.com
- **Zed Blog Feature:** https://zed.dev/blog/agentic-engineering-with-mitchell-hashimoto
- **Referenced by:** Simon Willison, Zed team
- **Focus:** Building Ghostty terminal emulator with AI

---

## Authors & People Mentioned (Not Yet Documented)

### Direct Citations

#### Strunk & White
- **Reference:** Tagged in obra's "Skills for Claude" post
- **Context:** Writing style guide (The Elements of Style)
- **Implication:** obra draws parallels between clear writing principles and skill documentation

### Indirect References

#### OpenAI Team
- **Referenced through:** Codex CLI product
- **Connection:** Building coding agents in competition/complement to Claude

#### Google Gemini Team
- **Referenced through:** Gemini CLI
- **Contributors:** 333+ on gemini-cli GitHub
- **Connection:** Active in coding agent space

#### Microsoft Research/Development Team
- **Referenced through:** Amplifier project
- **Connection:** Influenced obra's Superpowers skills

#### Anthropic Team
- **Referenced through:** 
  - Official Skills system
  - Plugin architecture
  - Model Context Protocol (MCP)
  - MS Office skills (early implementation)
- **Connection:** Building foundational infrastructure for agent development

---

## Patterns in Cross-References

### Who References Whom

**Simon Willison references:**
- Gergely Orosz (The Pragmatic Engineer)
- Mitchell Hashimoto (via tags)
- Own tools/TIL ecosystem extensively

**Jesse Vincent (obra) references:**
- Microsoft Amplifier team
- Anthropic (official skills)
- Own prior blog posts extensively
- Simon Willison's approach (implicit in parallel discussions)

**Peter Steinberger references:**
- Gergely Orosz (The Pragmatic Engineer)
- The Pragmatic Engineer newsletter
- Out In Tech organization

**Gergely Orosz references:**
- Senior engineers at large tech companies
- "Goto code reviewers" in organizations

### Topic Clusters

#### Parallel Agent Execution
- **Primary advocates:** Simon Willison, Peter Steinberger, Gergely Orosz
- **Tools mentioned:** Claude Code, Codex CLI, Gemini CLI
- **Key insight:** Experienced tech leads naturally understand parallel agent management

#### Skills & Knowledge Systems
- **Primary advocates:** Jesse Vincent, Microsoft Amplifier team
- **Tools:** Superpowers, Amplifier, Anthropic Skills
- **Key insight:** Systematic knowledge capture enables compound learning

#### Safety & Coordination
- **Primary advocate:** Peter Steinberger
- **Context:** Multi-agent environments require strict rules
- **Tools mentioned:** Cursor, Codex Web
- **Key insight:** Git operations are dangerous with agents

#### Test-Driven Development
- **Primary advocate:** Jesse Vincent
- **Application:** Both for code AND for documentation (skills)
- **Key insight:** RED-GREEN-REFACTOR applies to process docs

---

## Developer Tools Ecosystem

### Git-Related Tools
- **git bisect** - Mentioned by Simon Willison as particularly effective for LLMs
- **git worktrees** - Advocated by obra for parallel development
- **git hooks** - obra insists on never skipping pre-commit hooks

### Testing Frameworks
- Referenced implicitly through TDD discussions
- Subagents used for testing skills (obra's methodology)

### Development Methodologies
- **Brainstorm → Plan → Implement** (obra)
- **RED-GREEN-REFACTOR TDD** (obra, applied to docs)
- **Bowling with Bumpers** (Mitchell Hashimoto)
- **Model Competitions** (Mitchell Hashimoto)

---

## Organizations Mentioned

### Companies
- **OpenAI** - Codex CLI
- **Anthropic** - Claude Code, Skills, MCP
- **Google** - Gemini CLI
- **Microsoft** - Amplifier
- **HackerOne** - Forked superpowers-marketplace
- **Keyboard.io** - obra's company
- **PSPDFKit** - steipete's former company
- **HashiCorp** - Mitchell Hashimoto's former company (Vagrant, Terraform, etc.)
- **DittoLive** - Nick Pascucci's employer

### Open Source Projects
- **Django** - Simon Willison co-creator
- **Datasette** - Simon Willison creator
- **Ghostty** - Mitchell Hashimoto's terminal emulator
- **Aleph/Manifold** - Matthew Davidson (KingMob) lead developer

### Communities
- **Out In Tech** - steipete coaches there
- **The Pragmatic Engineer** - Newsletter community

---

## Key Concepts & Terminology

### Coined Terms
- **"Vibe Coding"** - Simon Willison (fast, loose, irresponsible AI coding)
- **"Vibe Engineering"** - Simon Willison (professional AI-assisted development)
- **"Slot machines for programmers"** - Peter Steinberger (describing AI agents)
- **"Bowling with bumpers"** - Mitchell Hashimoto (prompting approach)

### Methodologies
- **Claude Search Optimization (CSO)** - obra's term for making skills discoverable
- **Agentic Engineering** - Zed team's term for systematic AI-assisted development
- **TDD for Documentation** - obra's approach to skill creation

---

## Missing Perspectives to Research

Based on cross-references, these areas/people could yield additional thought leaders:

### 1. The "Experienced Engineers" Simon Mentions
- Who are the credible software engineers running multiple agents?
- Who beyond the documented leaders is publishing their workflows?

### 2. Microsoft Amplifier Contributors
- GitHub shows contributors to Amplifier
- Likely have insights on skills systems and agent coordination

### 3. Gemini CLI Contributors
- 333+ contributors suggests active community
- May have blogs/resources on agent development

### 4. The MCP/ACP Protocol Communities
- Who's building on these protocols?
- What are the key projects using them?

### 5. Early Adopters of Official Skills
- Anthropic mentions MS Office skills
- Who else is creating public skills?

### 6. Conference Circuit
- steipete speaks internationally
- Who else is speaking about agentic engineering?
- What conferences cover this space?

### 7. Newsletter/Media Authors
- Who writes for The Pragmatic Engineer?
- Other tech newsletters covering AI coding?

---

## Recommended Next Actions

1. **Research Amplifier contributors** - Check GitHub profiles
2. **Find Gemini CLI community** - Discord, discussions, blogs
3. **Track MCP ecosystem** - What projects are building on it?
4. **Monitor Zed sessions** - Who else has been featured in Agentic Engineering Sessions?
5. **Follow conference circuits** - Where is steipete speaking?
6. **Search for "vibe coding"** - Who else is using Simon's terminology?
7. **Track Superpowers forks** - Monitor for new forks and their authors' content
8. **Newsletter archaeology** - Read through Pragmatic Engineer archives for more names

---

## Update Log

- **2025-10-17:** Initial comprehensive analysis of all community_insights references
- Sources: All markdown files in community_insights folder, external link research, cross-reference analysis
