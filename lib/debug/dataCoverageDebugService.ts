import { getAllMacroScoreConfigs } from "@/lib/config/macroEngineConfig";
import type {
  MacroFactorConfig,
  MacroScoreKey,
} from "@/lib/config/macroEngineConfig.types";
import { classifyFreshness, type FreshnessStatus } from "@/lib/debug/freshnessPolicy";
import { NFCI_BENCHMARK_SYMBOLS } from "@/lib/debug/nfciBenchmarkService";

export type ConfiguredSymbolUsage = {
  symbol: string;
  name: string;
  source?: MacroFactorConfig["source"];
  frequency: string;
  signalTransform: string;
  transformLookbackDays?: number;
  minObservations: number;
  preferredZScoreWindows: number[];
  usages: Array<{
    scoreKey: MacroScoreKey;
    groupKey: string;
    role: string;
    scorePolarity: string;
    weight: number;
  }>;
};

const nfciBenchmarkNames: Record<(typeof NFCI_BENCHMARK_SYMBOLS)[number], string> = {
  NFCI: "Chicago Fed National Financial Conditions Index",
  ANFCI: "Chicago Fed Adjusted National Financial Conditions Index",
  NFCIRISK: "Chicago Fed NFCI Risk Subindex",
  NFCICREDIT: "Chicago Fed NFCI Credit Subindex",
  NFCILEVERAGE: "Chicago Fed NFCI Leverage Subindex",
};

function nfciBenchmarkUsage(): ConfiguredSymbolUsage[] {
  return NFCI_BENCHMARK_SYMBOLS.map((symbol) => ({
    symbol,
    name: nfciBenchmarkNames[symbol],
    source: "FRED",
    frequency: "weekly",
    signalTransform: "level",
    minObservations: 30,
    preferredZScoreWindows: [252, 504],
    usages: [],
  }));
}

export type CoverageStatus = FreshnessStatus;

export type CoverageRow = Omit<ConfiguredSymbolUsage, "transformLookbackDays"> & {
  status: CoverageStatus;
  freshnessStatus: FreshnessStatus;
  decayFactor: number;
  freshnessMessage: string;
  observationCount: number;
  firstDate: string | null;
  latestDate: string | null;
  daysSinceLatest: number | null;
  requiredMinimumObservations: number;
  preferredDefaultWindow: number | null;
  transformLookbackDays: number | null;
  affectedScores: MacroScoreKey[];
  message: string;
};

export type CoverageSummary = {
  totalConfiguredSymbols: number;
  okCount: number;
  freshCount: number;
  carriedForwardCount: number;
  decayingCount: number;
  missingCount: number;
  insufficientCount: number;
  staleCount: number;
  derivedCount: number;
  placeholderCount: number;
  notScoredCount: number;
  highImpactIssues: Array<{
    symbol: string;
    status: CoverageStatus;
    affectedScores: MacroScoreKey[];
    message: string;
  }>;
};

export type DataCoverageDebugPayload = {
  generatedAt: string;
  engineVersion: "data-coverage-debug";
  summary: CoverageSummary;
  rows: CoverageRow[];
  warnings: string[];
};

type DbStat = {
  symbol: string;
  observationCount: number;
  firstDate: Date | string | null;
  latestDate: Date | string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function daysSince(value: Date | string | null, now: Date): number | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS));
}

function uniqueScoreKeys(usages: ConfiguredSymbolUsage["usages"]): MacroScoreKey[] {
  return Array.from(new Set(usages.map((usage) => usage.scoreKey)));
}

function statusRank(status: CoverageStatus): number {
  const ranks: Record<CoverageStatus, number> = {
    missing: 0,
    insufficient: 1,
    stale: 2,
    decaying: 3,
    carried_forward: 4,
    fresh: 5,
    not_scored: 6,
    derived: 7,
    placeholder: 8,
  };
  return ranks[status];
}

export function collectConfiguredSymbolUsage(): ConfiguredSymbolUsage[] {
  const bySymbol = new Map<string, ConfiguredSymbolUsage>();

  for (const score of getAllMacroScoreConfigs()) {
    for (const group of score.factorGroups) {
      for (const factor of group.factors) {
        const existing = bySymbol.get(factor.symbol);
        if (!existing) {
          bySymbol.set(factor.symbol, {
            symbol: factor.symbol,
            name: factor.name,
            source: factor.source,
            frequency: factor.frequency,
            signalTransform: factor.signalTransform,
            transformLookbackDays: factor.transformLookbackDays,
            minObservations: factor.minObservations,
            preferredZScoreWindows: factor.preferredZScoreWindows,
            usages: [],
          });
        } else {
          existing.minObservations = Math.max(existing.minObservations, factor.minObservations);
          existing.preferredZScoreWindows = Array.from(new Set([...existing.preferredZScoreWindows, ...factor.preferredZScoreWindows])).sort((a, b) => a - b);
          existing.transformLookbackDays = existing.transformLookbackDays ?? factor.transformLookbackDays;
          if (existing.source !== factor.source && factor.source === "DERIVED") existing.source = factor.source;
          if (existing.source !== factor.source && factor.source === "PLACEHOLDER") existing.source = factor.source;
          if (existing.signalTransform !== factor.signalTransform && factor.signalTransform === "derived_ratio") existing.signalTransform = factor.signalTransform;
          if (existing.signalTransform !== factor.signalTransform && factor.signalTransform === "not_scored") existing.signalTransform = factor.signalTransform;
        }

        bySymbol.get(factor.symbol)!.usages.push({
          scoreKey: score.key,
          groupKey: group.key,
          role: factor.role,
          scorePolarity: factor.scorePolarity,
          weight: factor.weight,
        });
      }
    }
  }

  for (const benchmark of nfciBenchmarkUsage()) {
    if (!bySymbol.has(benchmark.symbol)) {
      bySymbol.set(benchmark.symbol, benchmark);
    }
  }

  return Array.from(bySymbol.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function buildCoverageRows(params: {
  configuredSymbols: ConfiguredSymbolUsage[];
  dbStats: DbStat[];
  now?: Date;
}): CoverageRow[] {
  const now = params.now ?? new Date();
  const statsBySymbol = new Map(params.dbStats.map((stat) => [stat.symbol, stat]));

  return params.configuredSymbols
    .map((symbolConfig) => {
      const stat = statsBySymbol.get(symbolConfig.symbol);
      const observationCount = stat?.observationCount ?? 0;
      const firstDate = dateKey(stat?.firstDate ?? null);
      const latestDate = dateKey(stat?.latestDate ?? null);
      const daysSinceLatest = daysSince(stat?.latestDate ?? null, now);
      const affectedScores = uniqueScoreKeys(symbolConfig.usages);
      const requiredMinimumObservations = symbolConfig.minObservations;
      const preferredDefaultWindow = symbolConfig.preferredZScoreWindows[0] ?? null;
      const freshness = classifyFreshness({
        source: symbolConfig.source,
        frequency: symbolConfig.frequency,
        signalTransform: symbolConfig.signalTransform,
        observationCount,
        requiredMinimumObservations,
        daysSinceLatest,
      });

      const row: CoverageRow = {
        ...symbolConfig,
        status: freshness.status,
        freshnessStatus: freshness.status,
        decayFactor: freshness.decayFactor,
        freshnessMessage: freshness.message,
        observationCount,
        firstDate,
        latestDate,
        daysSinceLatest,
        requiredMinimumObservations,
        preferredDefaultWindow,
        transformLookbackDays: symbolConfig.transformLookbackDays ?? null,
        affectedScores,
        message:
          symbolConfig.usages.length === 0 && freshness.status === "missing"
            ? `${symbolConfig.symbol} benchmark data is missing. Run npm run seed and npm run fetch:fred.`
            : `${symbolConfig.symbol} ${freshness.message}`,
      };
      return row;
    })
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.symbol.localeCompare(b.symbol));
}

export function buildCoverageSummary(rows: CoverageRow[]): CoverageSummary {
  const count = (status: CoverageStatus) => rows.filter((row) => row.status === status).length;
  const highImpactIssues = rows
    .filter((row) => ["missing", "insufficient", "stale"].includes(row.status))
    .filter((row) => row.source !== "DERIVED" && row.source !== "PLACEHOLDER")
    .filter((row) => row.affectedScores.length > 0)
    .map((row) => ({
      symbol: row.symbol,
      status: row.status,
      affectedScores: row.affectedScores,
      message: row.message,
    }));

  return {
    totalConfiguredSymbols: rows.length,
    okCount: count("fresh"),
    freshCount: count("fresh"),
    carriedForwardCount: count("carried_forward"),
    decayingCount: count("decaying"),
    missingCount: count("missing"),
    insufficientCount: count("insufficient"),
    staleCount: count("stale"),
    derivedCount: count("derived"),
    placeholderCount: count("placeholder"),
    notScoredCount: count("not_scored"),
    highImpactIssues,
  };
}

export function createDataCoverageDebugPayload(params: {
  configuredSymbols?: ConfiguredSymbolUsage[];
  dbStats: DbStat[];
  now?: Date;
}): DataCoverageDebugPayload {
  const rows = buildCoverageRows({
    configuredSymbols: params.configuredSymbols ?? collectConfiguredSymbolUsage(),
    dbStats: params.dbStats,
    now: params.now,
  });
  const summary = buildCoverageSummary(rows);
  const warnings: string[] = [];

  if (summary.missingCount > 0) warnings.push("Some configured symbols have no observations in database.");
  if (summary.insufficientCount > 0) warnings.push("Some configured symbols have insufficient observations.");
  if (summary.decayingCount > 0) warnings.push("Some configured symbols are decaying based on frequency-aware freshness policy.");
  if (summary.staleCount > 0) warnings.push("Some configured symbols are stale based on frequency-aware freshness policy.");
  if (rows.some((row) => row.symbol === "CNY=X" && row.status === "insufficient")) {
    warnings.push("CNY=X has insufficient observations and may weaken dollar_score diagnostics.");
  }

  return {
    generatedAt: (params.now ?? new Date()).toISOString(),
    engineVersion: "data-coverage-debug",
    summary,
    rows,
    warnings,
  };
}
