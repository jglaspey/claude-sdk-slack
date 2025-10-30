# Skills for Claude!

**Source:** https://blog.fsck.com/2025/10/16/skills-for-claude/  
**Author:** Jesse Vincent (obra)  
**Tags:** ai, writing, strunk

Anthropic is releasing their first-party Skills system across Claude Code, Claude.ai and the Claude API, all launching today. I can tell that they've been working on it for quite a while and I'm really excited about it.

In just a few minutes, I plan to release a new version of Superpowers that uses the official Skills system. Shortly after I first published this blog post, I released a new version of Superpowers that uses the official Skills system.

One of the new skills they were gracious enough to allow me to test out is a new 'creating MCPs' skill. Other than a small issue with the tool descriptions it generates being too verbose, it was by far the smoothest MCP development experience I've had so far. (I used it to make the 'search' tool for a new episodic memory plugin I'm building for Claude Code that I hope to release soon.)

I've been using skills in Claude Code for the better part of a month. Last week, when Anthropic shipped plugins support for Claude code, I celebrated by releasing my homebrew skills system as [Superpowers for Claude Code](https://blog.fsck.com/2025/10/09/superpowers/).

Superpowers is a couple of things:
- A bootstrap that teaches Claude Code to load SKILL.md files and when to use them, built as a SKILL.md file, a search tool, and a hook that initializes things on startup.
- A set of SKILL.md files designed to create, manage, and share SKILL.md files.
- A set of SKILL.md files that encode my Architect/Implementer agentic coding methodology, starting from the brainstorming process and running all the way through the TDD process.
- A set of SKILL.md files that encode a bunch of other software engineering skills.

Over the weekend, while I was reviewing a bug report from an end user, I saw a bunch of logging output from `claude --debug` that talked about skill files and skills directories. Which would make sense, since I was debugging a skills system.

The only problem was that the logging wasn't from Superpowers. (As a slightly funny aside: I had to check whether the log messages were from Superpowers or not. Since Claude did all the actual implementation work for Superpowers, I'd never actually looked at that bit of code.)

I built out Superpowers' core skill system based on spelunking around in Anthropic's initial few MS Office skills and bolting together some bits and pieces, along with some weird ideas I wanted to try out.

At the time, I had no idea that Claude Code had an apparently-complete implementation of a skills system hidden inside. Based on Anthropic's documentation, the first-party skills system has some support in Claude Code 2.0.0 and may have been there as far back as Claude Code 1.0!?

Had I known that Claude Code already had the magic bootstrappy parts that make SKILL.md files useful if their metadata is put together in just the right way, I absolutely wouldn't have built my own.

But, now that Skills are officially a thing, Superpowers is embracing the future.

As I'm starting to get familiar with the official skills system, it looks like the biggest design difference is that Anthropic's skills have a name, a description, a license (I think?) and a metadata field. Our skills had...flexible frontmatter, but the important parts were name, description, and when_to_use – We broke apart the answers to "When should Claude use this skill?" and "What does this skill do?" I still think that that distinction is important. In my testing, I've found that showing only "When should Claude use this skill?" leads to better compliance. When Claude thinks it knows what a skill does, it's more likely to believe it's using the skill and just wing it, even if it hasn't read it yet.

I've rewritten our core skills to switch things over to Anthropic's way of doing things. I've also broken apart our core skills into core Superpowers skills and a set of skills that we learned from [Microsoft's Amplifier](https://github.com/microsoft/amplifier).
