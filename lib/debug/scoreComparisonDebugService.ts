import { getMacroScoreConfig, macroScoreKeys } from "@/lib/config/macroEngineConfig";
import type { MacroFactorConfig, MacroScoreKey } from "@/lib/config/macroEngineConfig.types";
import type { ObservationSeriesMap, ShadowFactorContribution, ShadowScoreResult } from "@/lib/engines/shadowScoreEngine";

export const NEUTRAL_THRESHOLD = 0.25;

export type DirectionAgreement =
  | "same_positive"
  | "same_negative"
  | "both_neutral"
  | "true_opposite"
  | "v1_positive_v2_neutral"
  | "v1_negative_v2_neutral"
  | "v1_neutral_v2_positive"
  | "v1_neutral_v2_negative"
  | "unavailable";

export type MagnitudeBucket = "small" | "medium" | "large" | "unavailable";

export type ComparisonStatus = "ok" | "missing_v1" | "missing_v2" | "unavailable";

export type CurrentScoreDebugEntry = {
  scoreKey: MacroScoreKey;
  zhName: string;
  enName: string;
  value: number | null;
  status: "ok" | "missing" | "not_scored";
  message?: string;
};

export type ScoreComparisonEntry = {
  scoreKey: MacroScoreKey;
  zhName: string;
  enName: string;
  v1Value: number | null;
  v2Value: number | null;
  difference: number | null;
  absDifference: number | null;
  directionAgreement: DirectionAgreement;
  magnitudeBucket: MagnitudeBucket;
  status: ComparisonStatus;
};

export type ScoreComparisonPayload = {
  generatedAt: string;
  engineVersion: "v1-v2-score-comparison-debug";
  options: {
    preferredWindow: number | null;
    zScoreForFullSignal: number;
  };
  v1: {
    status: "ok" | "unavailable" | "partial";
    source: string;
    scores: Record<MacroScoreKey, CurrentScoreDebugEntry>;
  };
  v2: {
    status: "ok" | "partial" | "no_data";
    scores: Record<MacroScoreKey, ShadowScoreResult>;
  };
  comparison: Record<MacroScoreKey, ScoreComparisonEntry>;
  summary: {
    comparableScoreCount: number;
    sameDirectionCount: number;
    bothNeutralCount: number;
    trueOppositeDirectionCount: number;
    neutralDivergenceCount: number;
    oppositeDirectionCount: number;
    largeDifferenceCount: number;
    averageAbsDifference: number | null;
    largestDifferences: Array<{
      scoreKey: MacroScoreKey;
      zhName: string;
      v1Value: number | null;
      v2Value: number | null;
      absDifference: number | null;
    }>;
  };
  v2Diagnostics: {
    missingSymbols: string[];
    scoresWithNoData: Array<{
      scoreKey: MacroScoreKey;
      zhName: string;
      missingSymbols: string[];
      insufficientDataSymbols: string[];
      unsupportedSymbols: string[];
      contextDependentSymbols: string[];
      factors: Array<{
        symbol: string;
        name: string;
        status: ShadowFactorContribution["status"];
        message?: string;
        observationCount: number;
        latestDate: string | null;
        signalTransform: MacroFactorConfig["signalTransform"] | null;
        transformLookbackDays: number | null;
        preferredWindow: number | null;
        minObservations: number | null;
        normalizedSignal: number | null;
        zScore: number | null;
        rawValue: number | null;
        contribution: number;
      }>;
    }>;
  };
  warnings: string[];
};

type ScoreComparisonOptions = {
  preferredWindow?: number | null;
  zScoreForFullSignal?: number;
};

type MacroRegimeScoreSource = Partial<Record<MacroScoreKey, number | null>> & {
  liquidityScore?: number | null;
  inflationScore?: number | null;
  growthScore?: number | null;
  riskAppetiteScore?: number | null;
  dollarScore?: number | null;
  creditScore?: number | null;
  commodityScore?: number | null;
  chinaScore?: number | null;
};

const macroRegimeFieldByScore: Record<MacroScoreKey, keyof MacroRegimeScoreSource> = {
  liquidity_score: "liquidityScore",
  inflation_score: "inflationScore",
  growth_score: "growthScore",
  risk_appetite_score: "riskAppetiteScore",
  dollar_score: "dollarScore",
  credit_score: "creditScore",
  commodity_score: "commodityScore",
  china_score: "chinaScore",
};

function stableNumber(value: number): number {
  return Number(value.toFixed(6));
}

function direction(value: number | null): "positive" | "negative" | "neutral" | "unavailable" {
  if (value === null || !Number.isFinite(value)) return "unavailable";
  if (value > NEUTRAL_THRESHOLD) return "positive";
  if (value < -NEUTRAL_THRESHOLD) return "negative";
  return "neutral";
}

function directionAgreement(v1Value: number | null, v2Value: number | null): DirectionAgreement {
  const v1 = direction(v1Value);
  const v2 = direction(v2Value);
  if (v1 === "unavailable" || v2 === "unavailable") return "unavailable";
  if (v1 === "neutral" && v2 === "neutral") return "both_neutral";
  if (v1 === "positive" && v2 === "positive") return "same_positive";
  if (v1 === "negative" && v2 === "negative") return "same_negative";
  if ((v1 === "positive" && v2 === "negative") || (v1 === "negative" && v2 === "positive")) return "true_opposite";
  if (v1 === "positive" && v2 === "neutral") return "v1_positive_v2_neutral";
  if (v1 === "negative" && v2 === "neutral") return "v1_negative_v2_neutral";
  if (v1 === "neutral" && v2 === "positive") return "v1_neutral_v2_positive";
  if (v1 === "neutral" && v2 === "negative") return "v1_neutral_v2_negative";
  return "unavailable";
}

function magnitudeBucket(absDifference: number | null): MagnitudeBucket {
  if (absDifference === null) return "unavailable";
  if (absDifference < 1) return "small";
  if (absDifference < 2) return "medium";
  return "large";
}

function comparisonStatus(v1Value: number | null, v2Value: number | null): ComparisonStatus {
  if (v1Value === null && v2Value === null) return "unavailable";
  if (v1Value === null) return "missing_v1";
  if (v2Value === null) return "missing_v2";
  return "ok";
}

export function currentScoresFromMacroRegime(source: MacroRegimeScoreSource | null): Record<MacroScoreKey, CurrentScoreDebugEntry> {
  return macroScoreKeys.reduce((acc, scoreKey) => {
    const config = getMacroScoreConfig(scoreKey);
    const directValue = source?.[scoreKey];
    const macroRegimeValue = source?.[macroRegimeFieldByScore[scoreKey]];
    const value = directValue ?? macroRegimeValue ?? null;
    acc[scoreKey] = {
      scoreKey,
      zhName: config.zhName,
      enName: config.enName,
      value,
      status: value === null ? "missing" : "ok",
      message: value === null ? "Current v1 score is unavailable." : undefined,
    };
    return acc;
  }, {} as Record<MacroScoreKey, CurrentScoreDebugEntry>);
}

export function compareMacroScores(params: {
  v1Scores: Record<MacroScoreKey, number | null>;
  v2Scores: Record<MacroScoreKey, number | null>;
}): Record<MacroScoreKey, ScoreComparisonEntry> {
  return macroScoreKeys.reduce((acc, scoreKey) => {
    const config = getMacroScoreConfig(scoreKey);
    const v1Value = params.v1Scores[scoreKey] ?? null;
    const v2Value = params.v2Scores[scoreKey] ?? null;
    const difference = v1Value === null || v2Value === null ? null : stableNumber(v2Value - v1Value);
    const absDifference = difference === null ? null : stableNumber(Math.abs(difference));
    acc[scoreKey] = {
      scoreKey,
      zhName: config.zhName,
      enName: config.enName,
      v1Value,
      v2Value,
      difference,
      absDifference,
      directionAgreement: directionAgreement(v1Value, v2Value),
      magnitudeBucket: magnitudeBucket(absDifference),
      status: comparisonStatus(v1Value, v2Value),
    };
    return acc;
  }, {} as Record<MacroScoreKey, ScoreComparisonEntry>);
}

function aggregateV2Status(scores: Record<MacroScoreKey, ShadowScoreResult>): "ok" | "partial" | "no_data" {
  const scored = macroScoreKeys.map((key) => scores[key]).filter((score) => score.status !== "not_scored");
  if (scored.every((score) => score.status === "no_data")) return "no_data";
  if (scored.some((score) => score.status !== "ok")) return "partial";
  return "ok";
}

function isNeutralDivergence(directionValue: DirectionAgreement): boolean {
  return [
    "v1_positive_v2_neutral",
    "v1_negative_v2_neutral",
    "v1_neutral_v2_positive",
    "v1_neutral_v2_negative",
  ].includes(directionValue);
}

function latestDateFor(symbol: string, observationsBySymbol?: ObservationSeriesMap): string | null {
  const points = observationsBySymbol?.[symbol] ?? [];
  const latest = points
    .map((point) => new Date(point.date))
    .filter((date) => Number.isFinite(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())
    .at(-1);
  return latest ? latest.toISOString().slice(0, 10) : null;
}

function factorConfig(scoreKey: MacroScoreKey, symbol: string): MacroFactorConfig | null {
  return getMacroScoreConfig(scoreKey).factorGroups.flatMap((group) => group.factors).find((factor) => factor.symbol === symbol) ?? null;
}

function symbolsByStatus(factors: ShadowFactorContribution[], status: ShadowFactorContribution["status"]): string[] {
  return factors.filter((factor) => factor.status === status).map((factor) => factor.symbol).sort();
}

function buildV2Diagnostics(params: {
  v2Scores: Record<MacroScoreKey, ShadowScoreResult>;
  observationsBySymbol?: ObservationSeriesMap;
  preferredWindow?: number | null;
}): ScoreComparisonPayload["v2Diagnostics"] {
  const scoresWithNoData = macroScoreKeys
    .map((scoreKey) => {
      const score = params.v2Scores[scoreKey];
      const factors = score.groups.flatMap((group) => group.factors);
      const diagnosticFactors = factors.filter((factor) => factor.status !== "ok");
      if (score.status !== "no_data" && diagnosticFactors.length === 0) return null;

      return {
        scoreKey,
        zhName: score.zhName,
        missingSymbols: symbolsByStatus(factors, "missing_observations"),
        insufficientDataSymbols: symbolsByStatus(factors, "insufficient_data"),
        unsupportedSymbols: symbolsByStatus(factors, "unsupported_transform"),
        contextDependentSymbols: symbolsByStatus(factors, "context_dependent"),
        factors: diagnosticFactors.map((factor) => {
          const config = factorConfig(scoreKey, factor.symbol);
          return {
            symbol: factor.symbol,
            name: factor.name,
            status: factor.status,
            message: factor.message,
            observationCount: params.observationsBySymbol?.[factor.symbol]?.length ?? 0,
            latestDate: latestDateFor(factor.symbol, params.observationsBySymbol),
            signalTransform: config?.signalTransform ?? null,
            transformLookbackDays: config?.transformLookbackDays ?? null,
            preferredWindow: params.preferredWindow ?? config?.preferredZScoreWindows[0] ?? null,
            minObservations: config?.minObservations ?? null,
            normalizedSignal: factor.normalizedSignal,
            zScore: factor.zScore,
            rawValue: factor.rawValue,
            contribution: factor.contribution,
          };
        }),
      };
    })
    .filter((score): score is NonNullable<typeof score> => score !== null);

  return {
    missingSymbols: Array.from(new Set(scoresWithNoData.flatMap((score) => score.missingSymbols))).sort(),
    scoresWithNoData,
  };
}

export function createScoreComparisonPayload(params: {
  v1: {
    status: "ok" | "unavailable" | "partial";
    source: string;
    scores: Record<MacroScoreKey, CurrentScoreDebugEntry>;
  };
  v2Scores: Record<MacroScoreKey, ShadowScoreResult>;
  options?: ScoreComparisonOptions;
  observationsBySymbol?: ObservationSeriesMap;
  warnings?: string[];
  generatedAt?: Date;
}): ScoreComparisonPayload {
  const v1Values = macroScoreKeys.reduce((acc, key) => {
    acc[key] = params.v1.scores[key]?.value ?? null;
    return acc;
  }, {} as Record<MacroScoreKey, number | null>);
  const v2Values = macroScoreKeys.reduce((acc, key) => {
    const score = params.v2Scores[key];
    acc[key] = score.status === "no_data" ? null : score.value;
    return acc;
  }, {} as Record<MacroScoreKey, number | null>);
  const comparison = compareMacroScores({ v1Scores: v1Values, v2Scores: v2Values });
  const comparableEntries = Object.values(comparison).filter((entry) => entry.status === "ok" && entry.absDifference !== null);
  const largestDifferences = comparableEntries
    .slice()
    .sort((a, b) => (b.absDifference ?? 0) - (a.absDifference ?? 0))
    .slice(0, 5)
    .map((entry) => ({
      scoreKey: entry.scoreKey,
      zhName: entry.zhName,
      v1Value: entry.v1Value,
      v2Value: entry.v2Value,
      absDifference: entry.absDifference,
    }));
  const averageAbsDifference =
    comparableEntries.length === 0
      ? null
      : stableNumber(comparableEntries.reduce((sum, entry) => sum + (entry.absDifference ?? 0), 0) / comparableEntries.length);

  return {
    generatedAt: (params.generatedAt ?? new Date()).toISOString(),
    engineVersion: "v1-v2-score-comparison-debug",
    options: {
      preferredWindow: params.options?.preferredWindow ?? null,
      zScoreForFullSignal: params.options?.zScoreForFullSignal ?? 2,
    },
    v1: params.v1,
    v2: {
      status: aggregateV2Status(params.v2Scores),
      scores: params.v2Scores,
    },
    comparison,
    summary: {
      comparableScoreCount: comparableEntries.length,
      sameDirectionCount: comparableEntries.filter((entry) => entry.directionAgreement === "same_positive" || entry.directionAgreement === "same_negative").length,
      bothNeutralCount: comparableEntries.filter((entry) => entry.directionAgreement === "both_neutral").length,
      trueOppositeDirectionCount: comparableEntries.filter((entry) => entry.directionAgreement === "true_opposite").length,
      neutralDivergenceCount: comparableEntries.filter((entry) => isNeutralDivergence(entry.directionAgreement)).length,
      oppositeDirectionCount: comparableEntries.filter((entry) => entry.directionAgreement === "true_opposite").length,
      largeDifferenceCount: comparableEntries.filter((entry) => entry.magnitudeBucket === "large").length,
      averageAbsDifference,
      largestDifferences,
    },
    v2Diagnostics: buildV2Diagnostics({
      v2Scores: params.v2Scores,
      observationsBySymbol: params.observationsBySymbol,
      preferredWindow: params.options?.preferredWindow,
    }),
    warnings: params.warnings ?? [],
  };
}
