# Project Memory

## 2026-06-20

- Initialized project-local `AGENTS.md` and `MEMORY.md` because the workspace did not contain them and `~/.codex/templates` was unavailable.
- Current C4.2 task boundary: implement debug-only Stress Window Replay on top of historical replay. Do not change official Dashboard scores, official regime, alerts, confirmedRegimeEngine, Provider / Fetcher, Prisma schema, production score calculation, macroEngineConfig weights, normalizationEngine behavior, or shadowScoreEngine behavior.
- Validation boundary for this task: run `npm run typecheck` and `npm test`; do not run `npm run build`.
- Phase C4.2 implemented a debug-only `/debug/stress-window-replay` page and `/api/debug/stress-window-replay` route. Historical replay now supports custom `startDate` / `endDate` params while preserving existing days-mode behavior.
- Current local C4.2 replay verdicts at step 5: all four predefined stress windows returned `watch` with `partial` status because some shadow scores remain unavailable or partial during replay windows.
- Phase C4.2.1 added `partialReasons` to stress window replay output so each partial window explains focus unavailable, non-focus unavailable, focus unstable, non-focus unstable, expected unavailable scores, and whether the partial status affects promotion readiness. `china_score` is currently treated as expected unavailable.
- Phase C4.2.2 added stress replay score-level availability diagnostics and a 1095-day custom range lookback buffer. Current local diagnostic shows `credit_score` remains unavailable in 2020, 2022, and 2023 stress windows because `BAMLH0A0HYM2` has no observations before those window end dates in the local DB, not because of insufficient replay lookback.
