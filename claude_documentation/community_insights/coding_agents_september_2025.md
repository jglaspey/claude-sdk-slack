# How I'm using coding agents in September, 2025

**Source:** https://blog.fsck.com/2025/10/05/how-im-using-coding-agents-in-september-2025/  
**Author:** Jesse Vincent (obra)  
**Tags:** claude, agents, ai, coding

*[Eagle-eyed readers will note that, as I write this, it's October 2025. This post documents what I was doing up to a couple weeks ago. It's still good and I still recommend it.]*

Since I last wrote at the beginning of the summer, my methodology for using AI coding assistants has evolved a bit. This is a point-in-time writeup of a flow that's been pretty effective for me.

I'm still primarily using Claude Code.

First up, this is my [CLAUDE.md](https://raw.githubusercontent.com/obra/dotfiles/6e088092406cf1e3cc78d146a5247e934912f6f8/.claude/CLAUDE.md) as of this writing. It encodes a bunch of process documentation and rules that do a pretty good job keeping Claude on track.

When I want to start a new task on an existing project, I try to always use a git worktree to isolate that work from other tasks. This is increasingly important for me, because I find myself frequently running 3-4 parallel projects on a single codebase.

To set up a worktree:

```bash
cd the-project
mkdir .worktrees # the first time
cd .worktrees
git worktree add some-feature-description
cd some feature-description
npm install # or whatever the setup task for the project is
npm lint
npm test # to make sure I'm starting from a clean baseline
claude
```

Once I've got claude code running, I use my "brainstorming" prompt:

```
I've got an idea I want to talk through with you. I'd like you to help me turn it into a fully formed design and spec (and eventually an implementation plan) Check out the current state of the project in our working directory to understand where we're starting off, then ask me questions, one at a time, to help refine the idea. Ideally, the questions would be multiple choice, but open-ended questions are OK, too. Don't forget: only one question per message. Once you believe you understand what we're doing, stop and describe the design to me, in sections of maybe 200-300 words at a time, asking after each section whether it looks right so far.
```

That last bit is particularly critical. I find that AI models are especially prone to handing me walls of text when they think they're "done". And I'm prone to just tuning out a bit and thinking "it's probably fine" when confronted with a wall of text written by an agent. By telling Claude to limit its output to a couple hundred words at a time, I'm more likely to actually read and engage.

Once we've walked through the brainstorming process, I usually have a much clearer idea of what I'm doing, as does Claude. Claude will write the design out into docs/plans/ somewhere.

It often wants to leap right into an implementation, but that's not how I want it to work. Sometimes it tries to start writing code before I can stop it. If it does, I hit escape a couple times and rewind the conversation a bit to catch it. Recent updates to my CLAUDE.md reduce that tendency significantly.

The next step is the planning process. Here's the planning prompt I've been using:
