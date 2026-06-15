import { getMacroScoreConfig, macroScoreKeys } from "@/lib/config/macroEngineConfig";
import type { MacroScoreKey } from "@/lib/config/macroEngineConfig.types";
import type { ShadowScoreResult } from "@/lib/engines/shadowScoreEngine";

export const NEUTRAL_THRESHOLD = 0.25;

export type DirectionAgreement =
  | "same_positive"
  | "same_negative"
  | "both_neutral"
  | "opposite"
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
  return "opposite";
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

export function createScoreComparisonPayload(params: {
  v1: {
    status: "ok" | "unavailable" | "partial";
    source: string;
    scores: Record<MacroScoreKey, CurrentScoreDebugEntry>;
  };
  v2Scores: Record<MacroScoreKey, ShadowScoreResult>;
  options?: ScoreComparisonOptions;
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
      oppositeDirectionCount: comparableEntries.filter((entry) => entry.directionAgreement === "opposite").length,
      largeDifferenceCount: comparableEntries.filter((entry) => entry.magnitudeBucket === "large").length,
      averageAbsDifference,
      largestDifferences,
    },
    warnings: params.warnings ?? [],
  };
}
