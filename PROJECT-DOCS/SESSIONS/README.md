# Sessions Log Guide

## Purpose
This directory records every hands-on working session so we can audit progress, recall decisions quickly, and provide context to future collaborators.

## Numbering Convention
- Sessions are numbered sequentially using three digits (`001`, `002`, ...).
- Session filenames follow `NNN-session-name.md` (e.g., `001-project-setup.md`).
- Update `index.md` with the session number, Pacific Time date, tags, and summary.

## Pre-Planning Future Work
Sometimes we create session documents in advance to plan upcoming work, conduct research, and store contextual information before a feature or project is ready to begin.

**Pre-Planning Workflow:**
- Use the format `00x-documentname.md` for future planning sessions (e.g., `00x-ai-platforms-integration.md`, `00x-screenshot-automation.md`)
- These files store research findings, API explorations, architectural decisions, and implementation notes for work we know we will eventually do
- Content may include: API documentation notes, design considerations, third-party service comparisons, technical constraints, and decision rationale
- Pre-planning documents don't appear in the main index until activated

**Activating a Pre-Planned Session:**
When it's time to actually implement the planned work:
1. Rename the file from `00x-documentname.md` to the next sequential session number (e.g., `009-ai-platforms-integration.md`)
2. Add a new section at the top titled `## Active Implementation` or `## Session Work`
3. Move the previous research/planning content under a section titled `## Context & Research (Pre-Planning)`
4. Document the actual work completed in the new top section
5. Update `index.md` with the session entry using the new number
6. Fill in or update the YAML front matter with actual session dates

This approach ensures we capture valuable research and planning context without losing it, while maintaining a clear distinction between preparatory work and active implementation.

## Timestamp Standard
- All timestamps are normalized to Pacific Time (United States).
- Before writing session notes, run:w
  ```bash
  TZ=America/Los_Angeles date
  ```
  Copy the output into the YAML front matter (`created_at`, `last_updated`).

## Required YAML Front Matter
Each session file must begin with:
```yaml
---
number: 001
date: 2025-09-26
timezone: America/Los_Angeles
created_at: 2025-09-26T13:54:53-07:00
last_updated: 2025-09-26T13:54:53-07:00
tags:
  - setup
summary: "Short description for the index"
notes: "High-level highlight used in index"
---
```
- `tags` may include multiple labels (`setup`, `data`, `automation`, etc.).
- `summary` and `notes` should provide enough context for the index to stand alone.

## Session Body Structure
Recommended sections after the YAML block:
1. Title heading (`# Session NNN — Short Name`)
2. Comment reminding authors to run the date command
3. Sections: `Goals`, `Decisions & Configuration`, `Repo Updates`, `Next Steps`

## Index Maintenance
- When a session file is created, append a placeholder entry to `index.md`:
  - Tags: `⟨pending⟩`
  - Summary: `_pending_`
  - YAML object: `tags: []`, `summary: "pending"`
- After the session is complete and the YAML front matter is finalized, replace the placeholder tags/summary in both the listing and YAML block.

## Related References
- `../PROJECT.md` — master project plan
- `../README.md` — quickstart and repo overview
- `../CLAUDE.md` — prior assistant transcript/context

Keeping these rules consistent guarantees painless retrospectives and makes new-session triage effortless.
