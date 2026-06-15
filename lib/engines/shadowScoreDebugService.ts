import { getAllConfiguredFactors } from "@/lib/config/macroEngineConfig";
import type { MacroScoreKey } from "@/lib/config/macroEngineConfig.types";
import type { RawObservationPoint } from "@/lib/engines/normalizationEngine";
import {
  calculateAllShadowScores,
  type ObservationSeriesMap,
  type ShadowScoreEngineOptions,
  type ShadowScoreResult,
} from "@/lib/engines/shadowScoreEngine";

export type ShadowScoreDebugPayload = {
  generatedAt: string;
  engineVersion: "shadow-score-v2-debug";
  options: {
    preferredWindow: number | null;
    zScoreForFullSignal: number;
  };
  coverage: {
    requestedSymbolCount: number;
    availableSymbolCount: number;
    missingSymbolCount: number;
    requestedSymbols: string[];
    availableSymbols: string[];
    missingSymbols: string[];
  };
  scores: Record<MacroScoreKey, ShadowScoreResult>;
  warnings: string[];
};

export type ShadowScoreDebugSummary = Omit<ShadowScoreDebugPayload, "scores"> & {
  scores: Record<
    MacroScoreKey,
    {
      scoreKey: MacroScoreKey;
      zhName: string;
      enName: string;
      value: number;
      rawValue: number;
      status: ShadowScoreResult["status"];
      message?: string;
      groups: Array<{
        groupKey: string;
        zhName: string;
        enName: string;
        contribution: number;
        rawContribution: number;
        status: "ok" | "partial" | "no_data";
      }>;
    }
  >;
};

export function collectRequiredShadowSymbols(): string[] {
  const symbols = getAllConfiguredFactors()
    .filter((factor) => factor.signalTransform !== "not_scored")
    .filter((factor) => factor.scorePolarity !== "not_scored")
    .filter((factor) => factor.source !== "PLACEHOLDER")
    .map((factor) => factor.symbol);

  return Array.from(new Set(symbols)).sort();
}

function dateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function numericValue(value: number | string | null): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function buildObservationSeriesMap(
  rows: Array<{
    symbol: string;
    date: Date | string;
    value: number | string | null;
  }>,
): ObservationSeriesMap {
  const result: ObservationSeriesMap = {};

  for (const row of rows) {
    const value = numericValue(row.value);
    // Debug API drops invalid DB values here so coverage reflects usable input series.
    if (value === null) continue;
    const point: RawObservationPoint = { date: dateKey(row.date), value };
    result[row.symbol] = result[row.symbol] ?? [];
    result[row.symbol].push(point);
  }

  for (const symbol of Object.keys(result)) {
    result[symbol].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  return result;
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

export function createShadowScoreDebugPayload(params: {
  observationsBySymbol: ObservationSeriesMap;
  requestedSymbols: string[];
  availableSymbols: string[];
  options?: ShadowScoreEngineOptions;
  generatedAt?: Date;
}): ShadowScoreDebugPayload {
  const requestedSymbols = sortedUnique(params.requestedSymbols);
  const availableSymbols = sortedUnique(params.availableSymbols);
  const missingSymbols = requestedSymbols.filter((symbol) => !availableSymbols.includes(symbol));
  const responseOptions = {
    preferredWindow: params.options?.preferredWindow ?? null,
    zScoreForFullSignal: params.options?.zScoreForFullSignal ?? 2,
  };
  const engineOptions: ShadowScoreEngineOptions = {
    ...(params.options?.preferredWindow !== undefined ? { preferredWindow: params.options.preferredWindow } : {}),
    zScoreForFullSignal: responseOptions.zScoreForFullSignal,
  };
  const scores = calculateAllShadowScores({
    observationsBySymbol: params.observationsBySymbol,
    options: engineOptions,
  });
  const warnings: string[] = [];

  if (missingSymbols.length > 0) {
    warnings.push("Some configured symbols have no observations in database.");
  }
  if (scores.china_score?.status === "not_scored") {
    warnings.push("china_score is placeholder and not included in scored regime logic.");
  }
  if (Object.values(scores).some((score) => score.status === "no_data")) {
    warnings.push("Some shadow scores have no usable data.");
  }

  return {
    generatedAt: (params.generatedAt ?? new Date()).toISOString(),
    engineVersion: "shadow-score-v2-debug",
    options: responseOptions,
    coverage: {
      requestedSymbolCount: requestedSymbols.length,
      availableSymbolCount: availableSymbols.length,
      missingSymbolCount: missingSymbols.length,
      requestedSymbols,
      availableSymbols,
      missingSymbols,
    },
    scores,
    warnings,
  };
}

function groupStatus(group: ShadowScoreResult["groups"][number]): "ok" | "partial" | "no_data" {
  const scoredFactors = group.factors.filter((factor) => !["not_scored", "context_dependent"].includes(factor.status));
  if (scoredFactors.length === 0) return "no_data";
  const okCount = scoredFactors.filter((factor) => factor.status === "ok").length;
  if (okCount === 0) return "no_data";
  return okCount === scoredFactors.length ? "ok" : "partial";
}

export function createShadowScoreSummary(payload: ShadowScoreDebugPayload): ShadowScoreDebugSummary {
  const scores = Object.fromEntries(
    Object.entries(payload.scores).map(([scoreKey, score]) => [
      scoreKey,
      {
        scoreKey: score.scoreKey,
        zhName: score.zhName,
        enName: score.enName,
        value: score.value,
        rawValue: score.rawValue,
        status: score.status,
        message: score.message,
        groups: score.groups.map((group) => ({
          groupKey: group.groupKey,
          zhName: group.zhName,
          enName: group.enName,
          contribution: group.contribution,
          rawContribution: group.rawContribution,
          status: groupStatus(group),
        })),
      },
    ]),
  ) as ShadowScoreDebugSummary["scores"];

  return { ...payload, scores };
}
