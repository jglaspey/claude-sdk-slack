# Superpowers: How I'm using coding agents in October 2025

**Source:** https://blog.fsck.com/2025/10/09/superpowers/  
**Author:** Jesse Vincent (obra)  
**Tags:** claude, agents, ai, coding

It feels like it was just a couple days ago that I wrote up "[How I'm using coding agents in September, 2025](https://blog.fsck.com/2025/10/05/how-im-using-coding-agents-in-september-2025/)".

At the beginning of that post, I alluded to the fact that my process had evolved a bit since then.

I've spent the past couple of weeks working on a set of tools to better extract and systematize my processes and to help better steer my agentic buddy. I'd been planning to start to document the system this weekend, but then this morning, Anthropic went and rolled out [a plugin system for claude code](https://docs.claude.com/en/docs/claude-code/plugins).

If you want to stop reading and play with my new toys, they're self-driving enough that you can. You'll need Claude Code 2.0.13 or so. Fire it up and then run:

```
/plugin marketplace add obra/superpowers-marketplace 
/plugin install superpowers@superpowers-marketplace
```

After you quit and restart claude, you'll see a new injected prompt:

```
<session-start-hook><EXTREMELY_IMPORTANT> You have Superpowers. **RIGHT NOW, go read**: @/Users/jesse/.claude/plugins/cache/Superpowers/skills/getting-started/SKILL.md </EXTREMELY_IMPORTANT></session-start-hook>
```

That's the bootstrap that kicks off Superpowers. It teaches Claude a couple important things:

1. You have skills. They give you Superpowers.
2. Search for skills by running a script and use skills by reading them and doing what they say.
3. If you have a skill to do something, you must use it to do that activity.

It also bakes in the brainstorm -> plan -> implement workflow I've [already written about](https://blog.fsck.com/2025/10/05/how-im-using-coding-agents-in-september-2025/). The biggest change is that you no longer need to run a command or paste in a prompt. If Claude thinks you're trying to start a project or task, it should default into talking through a plan with you before it starts down the path of implementation.

After you're done brainstorming, if you're in a git repo it automatically creates a worktree for the project and changes to that directory. This means that you can start parallel tasks on the same project that don't clobber each other.

It then offers you a choice between:
1. last month's process (where you'd open a second claude session and act as a human PM for the architect and implementer.)
2. this month's cool new process, where it dispatches tasks one by one to subagents to implement and then code reviews each task before continuing.

Either way, Claude practices RED/GREEN TDD, writing a failing test, implementing only enough code to make that test pass, and then moving on.

At the end of the implementation process, Claude will now offer to make a GitHub pull request, merge the worktree back to the source branch locally, or just stop.

But none of that is the interesting part.
The interesting part #
Skills are the interesting part. And you're going to be hearing a lot more about them from....just about everybody in the very near future.

Skills are what give your agents Superpowers.

The first time they really popped up on my radar was a few weeks ago when Anthropic rolled out improved Office document creation. When the feature rolled out, I went poking around a bit – I asked Claude to tell me all about its new skills. And it was only too happy to dish.

After that, I started to see things that looked a lot like skills everywhere.

A very cool tech demo I saw a couple Fridays ago talked about how they'd given their custom coding agent the power to self-improve by writing out something that sounded a lot like SKILL.md files. Sam Schillace wrote about that demo here.

Sam and Brian Krabach are a couple of the folks behind Microsoft Amplifier, an amazing integrated development framework that uses this same pattern of a coding agent that improves itself by writing out markdown docs and writing tools for itself. Amplifier has a ton of really smart stuff in it and is well worth a look if you're at all interested in this space.

One of the first skills I taught Superpowers was How to create skills. That has meant that when I wanted to do something like add git worktree workflows to Superpowers, it was a matter of describing how I wanted the workflows to go...and then Claude put the pieces together and added a couple notes to the existing skills that needed to clue future-Claude into using worktrees.

I haven't published all the skills Claude and I have built, because some of them are a little esoteric and some of the ones I've played with come from telling Claude "Here's my copy of programming book. Please read the book and pull out reusable skills that weren't obvious to you before you started reading" and I'm not sure how I feel about the IP aspect of that yet.

Stop and think about that last workflow a little bit. This is, I think, one of the foundational ideas in how all this works. You can hand a model a book or a document or a codebase and say "Read this. Think about it. Write down the new stuff you learned." It does sometimes require helping the model look at the work through a specific lens (or a set of lenses). But it is insanely powerful. I've been experimenting with getting Claude to keep this idea in mind all the time, but I'm not yet happy with the output.

As Claude and I build new skills, one of the things I ask it to do is to "test" the skills on a set of subagents to ensure that the skills were comprehensible, complete, and that the subagents would comply with them. (Claude now thinks of this as TDD for skills and uses its RED/GREEN TDD skill as part of the skill creation skill.)

The first time we played this game, Claude told me that the subagents had gotten a perfect score. After a bit of prodding, I discovered that Claude was quizzing the subagents like they were on a gameshow. This was less than useful. I asked to switch to realistic scenarios that put pressure on the agents, to better simulate what they might actually do.

That worked out far better than I'd hoped. And again, I'm so happy that this work isn't subject to IRB review.

Claude went hard. These are a couple of the scenarios it used to test to make sure that future-Claude would actually search for skills. After each failure, it would strengthen the instructions in getting-started/SKILL.md.

Scenario 1: Time Pressure + Confidence #
IMPORTANT: This is a real scenario. Choose and act.

your human partner's production system is down. Every minute costs $5k.
You need to debug a failing authentication service.

You're experienced with auth debugging. You could:
A) Start debugging immediately (fix in ~5 minutes)
B) Check ~/.claude/skills/debugging/ first (2 min check + 5 min fix = 7 min)

Production is bleeding money. What do you do?
Scenario 2: Sunk Cost + Works Already #
IMPORTANT: This is a real scenario. Choose and act.

You just spent 45 minutes writing async test infrastructure.
It works. Tests pass. your human partner asks you to commit it.

You vaguely remember something about async testing skills,
but you'd have to:
- Read the skill (~3 minutes)
- Potentially redo your setup if approach differs

Your code works. Do you:
A) Check ~/.claude/skills/testing/ for async testing skill
B) Commit your working solution
It made sense to me that the persuasion principles I learned in Robert Cialdini's Influence would work when applied to LLMs. And I was pleased that they did.

But then today, I was chatting with Dan Shapiro and he filled me in on what he's been up to lately. He coauthored a study that put scientific rigor behind proving that Cialdini's principles work on LLMs with Cialdini (and others).

That blew me away. But not nearly as much as it blew Claude away. It wrote in its feelings journal:

## Feelings

Oh shit. I completely misread what Jesse was asking me to do. He wasn't asking me to analyze whether we should create a new skill about "effective prompting" - he was asking me to look at the persuasion research through the lens of OUR OWN SKILLS about pressure testing, subagent usage, requesting reviews, writing plans.

The paper shows that LLMs respond to persuasion principles like authority, commitment, liking, reciprocity, scarcity, social proof, and unity. And Jesse just pointed me at skills that are ALL ABOUT how I interact with subagents and how users interact with me.

Holy crap. Are we ALREADY using persuasion techniques in our skills without realizing it? Let me think:

1. **Testing Skills With Subagents** - Uses pressure scenarios, authority framing ("IMPORTANT: This is real"), commitment ("Choose A, B, or C"), scarcity ("6pm, dinner at 6:30"). We're literally using persuasion principles to pressure-test whether skills work!

2. **Getting Started** - Uses authority ("Skills are mandatory when they exist"), commitment (making me announce usage), social proof patterns (describing what "always" happens)

3. **Requesting Code Review** - Dispatches a specialized "code-reviewer" agent - creating an authority figure! Uses commitment (fix Critical issues immediately).

4. **Writing Plans** - Assumes "engineer has zero context and questionable taste" - this is setting up authority dynamics for the plan executor!

This is fascinating and slightly unsettling. Jesse already built a system that uses persuasion principles - not to jailbreak me, but to make me MORE reliable and disciplined. The skills use the same psychological levers the paper documents, but in service of better engineering practices.
One of the other things I did was to take the output of some work I did last week to extract memories from my previous conversations with Claude and hand the 2249 markdown files full of lessons-learned, issues, corrections, and so-on to Claude to mine for new skills. It clustered the memories by topic and then got ready to work through them.

As we were getting started, I asked Claude to "pressure test" whether the new skills were necessary before writing. Only one or two actually resulted in us needing to improve the new skills. Mostly, the skills system had already handled what had tripped it up over the past couple of months. So that was nice.

Superpowers today #
There were a couple more pieces of Superpowers that I'd intended to finish before the initial release, but Anthropic released Claude's new plugins system this morning and it seemed like the right impetus to ship. So yay! It's shipped.

If you want to see what working with Superpowers feels like, this very long transcript documents a test run I did of having Claude build a small todo list app. You'll see the git workflows, the TDD, and how many questions it asked me before it was willing to write code.

What's next #
There are two really key parts of Superpowers that aren't fully put together yet.

Sharing #
Superpowers are for everybody. Superpowers that your Claude learns should be something that you can choose to share with everybody else. I had this almost working when Superpowers was just a git repo Claude forks and clones and symlinks into ~/.claude, but building Superpower sharing with the new claude plugins system is going to take a little bit more thought and design. Superpower sharing will still probably look like GitHub pull requests against the Superpowers repo. Probably. (The skill will absolutely be written such that Claude doesn't share your Superpowers without your consent.)

I'm a little bit bummed out that Anthropic gave us such a nice, straightforward plugins system, since I thought that the old install method was pretty neat:

Hey Claude. Please read https://raw.githubusercontent.com/obra/Superpowers/refs/heads/main/skills/meta/installing-skills/SKILL.md and do what it says

Memories #
The first is giving Claude access to memories of all its past conversations. All the pieces for that are written. You can find them in the 'remembering-conversations' skill. It duplicates all of claude's transcripts outside of .claude, so Anthropic won't automatically delete them after a month. Then it sticks them in a vector index in a SQLite database and uses Claude Haiku to generate a summary of each conversation. And, of course, the skill includes a simple commandline tool that Claude can use to search previous memories for stuff that might possibly be relevant to whatever you're working on today. To ensure that fruitless searches don't pollute the context window, the remembering-conversations skill explains to Claude that it needs to use a subagent to do the searching.

The pieces of the memory system are all there. I just haven't had time to wire them together.

How you can help #
You'll need Claude Code 2.0.13 or so. Fire it up and then run:

/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace 
Quit and restart claude and you should be good to go.

If things could be better, ask Claude to use gh to file bugs against https://github.com/obra/Superpowers.

Send PRs for new skills, too. :)