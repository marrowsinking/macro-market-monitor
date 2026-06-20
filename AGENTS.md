## Project

- Name: My Market Monitor / macro-market-monitor
- Stack: Next.js App Router, TypeScript, Tailwind CSS, Prisma, SQLite, Vitest
- Default language for collaboration: Traditional Chinese

## Working Rules

- Read `AGENTS.md` and `MEMORY.md` before making project changes.
- Do not commit secrets, API keys, local database files, backups, or `.DS_Store`.
- Do not run `npm run build` while the dev server is running.
- For normal verification, prefer `npm run typecheck` and `npm test`.
- Keep debug and shadow-score work separate from official Dashboard scoring unless explicitly promoted.
- Do not change official scoring, regime logic, Provider / Fetcher, or Prisma schema unless the task explicitly asks for it.

## Product Principles

- User experience comes first: reduce friction, surface the core answer first, and keep technical detail available on demand.
- This project is a local-first macro market research and decision-support tool, not investment advice.
- Debug pages may expose detailed diagnostics, but they should not affect official Dashboard, regime, alerts, or update pipeline behavior.

## Current Phase Notes

- Phase C4.x work is debug-only.
- Historical replay and stress-window replay must avoid look-ahead bias by filtering observations to `date <= asOfDate`.
- Validation for C4.x tasks: `npm run typecheck` and `npm test`; do not run `npm run build`.
