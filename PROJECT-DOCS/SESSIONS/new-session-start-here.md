# New Sessions Start Here

Welcome! Follow these steps whenever you begin a working session.

1. **Check the context**
   - Review [`PROJECT.md`](../PROJECT.md) for the current roadmap and architecture decisions.
   - Scan [`README.md`](../README.md) for quickstart instructions.
   - Revisit [`CLAUDE.md`](../CLAUDE.md) to recall previous assistant context.
   - Skim the sessions log (below) to see recent activity.

2. **Create your session file**
   - Run `TZ=America/Los_Angeles date` and capture the exact timestamp.
   - Copy the YAML template from [`sessions/README.md`](./README.md).
   - Save the new file as `NNN-your-session-name.md` (increment `NNN`).

3. **Update the index**
   - Add a row to [`sessions/index.md`](./index.md) with the session number, PT date, tags, and summary matching your YAML.

4. **Log your work**
   - Follow the suggested section structure (`Goals`, `Decisions`, `Repo Updates`, `Next Steps`).
   - Include any metrics, screenshots, or commands that matter.

5. **Wrap up**
   - Confirm `last_updated` in your YAML matches the final timestamp.
   - Double-check that summaries/notes align between YAML and the index.

> Need a refresher? Visit [`sessions/README.md`](./README.md) for detailed guidelines.

Happy building—this workflow keeps the project auditable and future-proof.
