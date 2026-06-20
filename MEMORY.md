# Project Memory

## 2026-06-20

- Initialized project-local `AGENTS.md` and `MEMORY.md` because the workspace did not contain them and `~/.codex/templates` was unavailable.
- Current C4.2 task boundary: implement debug-only Stress Window Replay on top of historical replay. Do not change official Dashboard scores, official regime, alerts, confirmedRegimeEngine, Provider / Fetcher, Prisma schema, production score calculation, macroEngineConfig weights, normalizationEngine behavior, or shadowScoreEngine behavior.
- Validation boundary for this task: run `npm run typecheck` and `npm test`; do not run `npm run build`.
- Phase C4.2 implemented a debug-only `/debug/stress-window-replay` page and `/api/debug/stress-window-replay` route. Historical replay now supports custom `startDate` / `endDate` params while preserving existing days-mode behavior.
- Current local C4.2 replay verdicts at step 5: all four predefined stress windows returned `watch` with `partial` status because some shadow scores remain unavailable or partial during replay windows.
