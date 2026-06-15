# Macro Market Monitor

## Overview

Macro Market Monitor is a local-first macro market monitoring dashboard built with Next.js, TypeScript, Prisma, and SQLite.

It is designed to track macroeconomic and cross-asset indicators, calculate regime-related scores, and surface diagnostics for market regime research. The project combines economic data, market data, score logic, confirmed regime state, and debug tooling into one local research workflow.

This is a personal research and decision-support tool. It is not investment advice, and it should not be treated as a predictive or institutional-grade model.

## Key Features

- Dashboard overview for daily macro market monitoring
- Rule-based macro regime scoring
- Eight macro score dimensions:
  - Liquidity
  - Inflation
  - Growth
  - Risk Appetite
  - Dollar Pressure
  - Credit
  - Commodity Cycle
  - China Macro
- Indicator catalog with filtering, search, sorting, and status visibility
- Methodology page explaining the framework
- Debug pages:
  - `/debug/data-coverage`
  - `/debug/score-comparison`
  - `/debug/shadow-scores`
- Data update pipeline for FRED, Yahoo Finance, regime calculation, and alerts
- Confirmed regime and pending regime logic to reduce one-day noise
- Shadow score engine for v2 scoring diagnostics
- Data coverage diagnostics for missing, stale, insufficient, derived, and placeholder factors

## Data Sources

- FRED is used for macroeconomic data.
- Yahoo Finance is used for market, commodity, and FX data.
- Prisma writes observations and application state to a local SQLite database.
- USDCNY / `CNY=X` is used as the yuan pressure proxy because Yahoo Finance does not provide sufficient long-history CNH data.
- CNY and CNH are not identical. `CNY=X` is used here only as a practical onshore yuan proxy for dollar pressure diagnostics.

## Methodology Summary

The system uses a rule-based macro regime framework. Indicators are grouped into score dimensions, and each factor has defined direction, score polarity, signal transform metadata, rolling normalization settings, and grouped contribution logic.

Scores are based on transformed indicator signals, rolling normalization, score polarity, and factor group contributions. Shadow scores are used for diagnostics and comparison against the existing v1 scoring logic; they do not automatically replace official dashboard scoring unless explicitly promoted.

Confirmed regime logic is separated from daily signal changes. The daily raw signal can change quickly, while the confirmed regime requires repeated confirmation before switching. This helps reduce noisy regime flips caused by short-term market moves.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- SQLite
- Vitest
- FRED API
- Yahoo Finance data provider

## Local Setup

```bash
npm install
npx prisma migrate dev
npm run seed
npm run fetch:fred
npm run fetch:yahoo
npm run calculate:regime
npm run dev
```

The app usually runs at:

```text
http://localhost:3000
```

API keys should be stored in local environment variables such as `.env.local`. Do not hard-code keys in source files.

## Useful Scripts

```bash
npm run dev
npm run typecheck
npm test
npm run seed
npm run fetch:fred
npm run fetch:yahoo
npm run calculate:regime
npm run update:data
npm run backfill:cny
npm run backfill:cnh
npm run diagnose:yahoo-fx
```

Script notes:

- `npm run update:data` runs the normal data update pipeline.
- `npm run backfill:cny` backfills Yahoo Finance `CNY=X` observations for the yuan pressure proxy.
- `npm run backfill:cnh` is retained for historical CNH diagnostics, but Yahoo Finance currently provides insufficient long-history CNH data.
- `npm run diagnose:yahoo-fx` checks Yahoo FX aliases for USDCNH / CNH / CNY coverage without writing to the database.

## Debug / Diagnostic Pages

- `/debug/data-coverage`
  - Checks configured factor coverage.
  - Shows missing data, insufficient history, stale series, placeholders, and derived factors.

- `/debug/score-comparison`
  - Compares v1 official regime scores with v2 shadow scores.
  - Helps identify score divergence, neutral attenuation, true opposite signals, and missing v2 factor data.

- `/debug/shadow-scores`
  - Shows detailed shadow score calculation.
  - Includes group contribution, factor status, z-score, normalized signal, raw value, and contribution.

These debug pages are research tools. They are not part of the official scoring pipeline unless explicitly promoted.

## Important Notes

- Do not commit local database files or database backups.
- Do not commit `.DS_Store`.
- API keys should be stored in local environment variables and never committed.
- The methodology and scoring logic are still evolving.
- This project is not financial advice.

## Development Safety

- Do not run `npm run build` while the dev server is running.
- During development, prefer:

```bash
npm run typecheck
npm test
```

- Keep debug and shadow logic separate from official dashboard scoring unless explicitly promoted.
- Avoid treating shadow score output as official regime output until the promotion path is clearly defined and tested.
