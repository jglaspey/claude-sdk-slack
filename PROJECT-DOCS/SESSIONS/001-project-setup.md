---
number: 001
date: 2025-09-26
timezone: America/Los_Angeles
created_at: 2025-09-26T13:54:53-07:00
last_updated: 2025-09-26T13:54:53-07:00
tags:
  - setup
  - docs
summary: "SerpApi-first strategy documented; sessions logging framework created."
notes: "Aligned on SerpApi/DataForSEO split; created sessions index and setup doc."
---

# Session 001 — Project Setup

> <!-- Always run `TZ=America/Los_Angeles date` before logging to keep timestamps in Pacific Time. -->

## Goals
- Align on data sources for each Wins Tracker column.
- Decide when to use SerpApi vs DataForSEO and document the rationale.
- Establish logging of pixel positions and screenshot handling for Google SERPs.
- Create a repeatable log of working sessions.

## Decisions & Configuration
- SerpApi is now the primary Google provider (SERPs, AI Overview, screenshots, pixel positions).
- DataForSEO remains the fill-in for Bing screenshots and any non-Google engines (ChatGPT, Copilot, Perplexity, etc.).
- Persist `search_metadata` from SerpApi (IDs, screenshot URL, `pixel_position_endpoint`) for downstream bounding-box rendering.
- PROJECT.md updated to reflect the new provider mix and logging requirements.

## Repo Updates
- `PROJECT.md` refreshed with the SerpApi-first strategy and pixel metadata requirements.
- Added `/sessions/index.md` to catalog future working sessions.
- Added `/sessions/project-setup.md` (this file) capturing setup outcomes.

## Next Steps
- Build ingestion that fans out SerpApi runs per keyword + location.
- Integrate DataForSEO tasks for the missing tracker columns.
- Automate screenshot bundling (SerpApi PNG + DataForSEO captures).
- Extend logging/reporting to include pixel coordinates and screenshot references.
