import { getAllMacroScoreConfigs } from "@/lib/config/macroEngineConfig";
import type {
  MacroFactorConfig,
  MacroScoreKey,
} from "@/lib/config/macroEngineConfig.types";

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

export type CoverageStatus =
  | "ok"
  | "missing"
  | "insufficient"
  | "stale"
  | "derived"
  | "placeholder"
  | "not_scored";

export type CoverageRow = Omit<ConfiguredSymbolUsage, "transformLookbackDays"> & {
  status: CoverageStatus;
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

function staleThreshold(frequency: string): number | null {
  if (frequency === "daily_market" || frequency === "daily_rate") return 10;
  if (frequency === "weekly") return 21;
  if (frequency === "monthly_macro") return 75;
  return null;
}

function uniqueScoreKeys(usages: ConfiguredSymbolUsage["usages"]): MacroScoreKey[] {
  return Array.from(new Set(usages.map((usage) => usage.scoreKey)));
}

function statusMessage(row: {
  symbol: string;
  status: CoverageStatus;
  observationCount: number;
  requiredMinimumObservations: number;
  daysSinceLatest: number | null;
  affectedScores: MacroScoreKey[];
}): string {
  if (row.status === "placeholder") return "Placeholder factor; data source is not connected yet.";
  if (row.status === "derived") return "Derived factor; it is not expected to have direct database observations.";
  if (row.status === "not_scored") return "Configured as not scored.";
  if (row.status === "missing") return `${row.symbol} has no observations in database.`;
  if (row.status === "insufficient") return `${row.symbol} has ${row.observationCount} observations, below required minimum ${row.requiredMinimumObservations}.`;
  if (row.status === "stale") return `${row.symbol} latest observation is ${row.daysSinceLatest} days old.`;
  return `${row.symbol} coverage is sufficient for ${row.affectedScores.join(", ")}.`;
}

function statusRank(status: CoverageStatus): number {
  const ranks: Record<CoverageStatus, number> = {
    missing: 0,
    insufficient: 1,
    stale: 2,
    ok: 3,
    not_scored: 4,
    derived: 5,
    placeholder: 6,
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
      const threshold = staleThreshold(symbolConfig.frequency);
      let status: CoverageStatus;

      if (symbolConfig.source === "PLACEHOLDER" && symbolConfig.signalTransform === "not_scored") {
        status = "placeholder";
      } else if (symbolConfig.source === "DERIVED" || symbolConfig.signalTransform === "derived_ratio") {
        status = "derived";
      } else if (symbolConfig.signalTransform === "not_scored" || symbolConfig.usages.every((usage) => usage.scorePolarity === "not_scored")) {
        status = "not_scored";
      } else if (observationCount === 0) {
        status = "missing";
      } else if (observationCount < requiredMinimumObservations) {
        status = "insufficient";
      } else if (threshold !== null && daysSinceLatest !== null && daysSinceLatest > threshold) {
        status = "stale";
      } else {
        status = "ok";
      }

      const row: CoverageRow = {
        ...symbolConfig,
        status,
        observationCount,
        firstDate,
        latestDate,
        daysSinceLatest,
        requiredMinimumObservations,
        preferredDefaultWindow,
        transformLookbackDays: symbolConfig.transformLookbackDays ?? null,
        affectedScores,
        message: "",
      };
      row.message = statusMessage(row);
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
    okCount: count("ok"),
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
  if (summary.staleCount > 0) warnings.push("Some configured symbols have stale observations.");
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
