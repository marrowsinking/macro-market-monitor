import {
  getAllMacroScoreConfigs,
  getScorePolarityMultiplier,
} from "@/lib/config/macroEngineConfig";
import type {
  MacroScoreKey,
  MacroScoreConfig,
  MacroFactorGroupConfig,
  MacroFactorConfig,
} from "@/lib/config/macroEngineConfig.types";
import {
  calculateNormalizedSignal,
  clamp,
  type RawObservationPoint,
  type NormalizedSignalResult,
} from "@/lib/engines/normalizationEngine";

export type ObservationSeriesMap = Record<string, RawObservationPoint[]>;

export type ShadowContributionStatus =
  | "ok"
  | "missing_observations"
  | "insufficient_data"
  | "invalid_data"
  | "not_scored"
  | "context_dependent"
  | "unsupported_transform";

export type ShadowFactorContribution = {
  scoreKey: MacroScoreKey;
  groupKey: string;
  symbol: string;
  name: string;
  weight: number;
  scorePolarity: MacroFactorConfig["scorePolarity"];
  polarityMultiplier: number;
  normalizedSignal: number | null;
  zScore: number | null;
  percentile: number | null;
  rawValue: number | null;
  contribution: number;
  status: ShadowContributionStatus;
  message?: string;
};

export type ShadowGroupContribution = {
  scoreKey: MacroScoreKey;
  groupKey: string;
  zhName: string;
  enName: string;
  minContribution: number;
  maxContribution: number;
  rawContribution: number;
  contribution: number;
  capApplied: boolean;
  factors: ShadowFactorContribution[];
};

export type ShadowScoreResult = {
  scoreKey: MacroScoreKey;
  zhName: string;
  enName: string;
  value: number;
  rawValue: number;
  groups: ShadowGroupContribution[];
  status: "ok" | "partial" | "no_data" | "not_scored";
  message?: string;
};

export type ShadowScoreEngineOptions = {
  preferredWindow?: number;
  zScoreForFullSignal?: number;
};

export function mapNormalizedStatusToContributionStatus(
  status: NormalizedSignalResult["status"] | string,
): ShadowContributionStatus {
  if (status === "ok") return "ok";
  if (status === "insufficient_data") return "insufficient_data";
  if (status === "invalid_data") return "invalid_data";
  if (status === "not_scored") return "not_scored";
  if (status === "unsupported_transform") return "unsupported_transform";
  return "invalid_data";
}

function baseFactorResult(params: {
  scoreKey: MacroScoreKey;
  groupKey: string;
  factor: MacroFactorConfig;
  status: ShadowContributionStatus;
  polarityMultiplier?: number;
  message?: string;
}): ShadowFactorContribution {
  const polarityMultiplier = params.polarityMultiplier ?? getScorePolarityMultiplier(params.factor.scorePolarity);
  return {
    scoreKey: params.scoreKey,
    groupKey: params.groupKey,
    symbol: params.factor.symbol,
    name: params.factor.name,
    weight: params.factor.weight,
    scorePolarity: params.factor.scorePolarity,
    polarityMultiplier,
    normalizedSignal: null,
    zScore: null,
    percentile: null,
    rawValue: null,
    contribution: 0,
    status: params.status,
    message: params.message,
  };
}

export function calculateShadowFactorContribution(params: {
  scoreKey: MacroScoreKey;
  groupKey: string;
  factor: MacroFactorConfig;
  observations: RawObservationPoint[] | undefined;
  options?: ShadowScoreEngineOptions;
}): ShadowFactorContribution {
  const { scoreKey, groupKey, factor, observations, options } = params;
  const polarityMultiplier = getScorePolarityMultiplier(factor.scorePolarity);

  if (factor.scorePolarity === "not_scored" || factor.signalTransform === "not_scored") {
    return baseFactorResult({ scoreKey, groupKey, factor, status: "not_scored", polarityMultiplier });
  }

  if (factor.scorePolarity === "context_dependent") {
    return baseFactorResult({
      scoreKey,
      groupKey,
      factor,
      status: "context_dependent",
      polarityMultiplier,
      message: "context-dependent factor is tracked but not directly scored in v2 shadow score.",
    });
  }

  if (!observations || observations.length === 0) {
    return baseFactorResult({ scoreKey, groupKey, factor, status: "missing_observations", polarityMultiplier });
  }

  const normalized = calculateNormalizedSignal(observations, factor, options);
  const status = mapNormalizedStatusToContributionStatus(normalized.status);
  if (normalized.status !== "ok" || normalized.normalizedSignal === null) {
    return {
      ...baseFactorResult({ scoreKey, groupKey, factor, status: normalized.normalizedSignal === null && status === "ok" ? "invalid_data" : status, polarityMultiplier, message: normalized.message }),
      zScore: normalized.zScore,
      percentile: normalized.percentile,
      rawValue: normalized.rawValue,
      normalizedSignal: normalized.normalizedSignal,
    };
  }

  return {
    scoreKey,
    groupKey,
    symbol: factor.symbol,
    name: factor.name,
    weight: factor.weight,
    scorePolarity: factor.scorePolarity,
    polarityMultiplier,
    normalizedSignal: normalized.normalizedSignal,
    zScore: normalized.zScore,
    percentile: normalized.percentile,
    rawValue: normalized.rawValue,
    contribution: normalized.normalizedSignal * polarityMultiplier * factor.weight,
    status: "ok",
    message: normalized.message,
  };
}

export function calculateShadowGroupContribution(params: {
  scoreKey: MacroScoreKey;
  group: MacroFactorGroupConfig;
  observationsBySymbol: ObservationSeriesMap;
  options?: ShadowScoreEngineOptions;
}): ShadowGroupContribution {
  const factors = params.group.factors.map((factor) =>
    calculateShadowFactorContribution({
      scoreKey: params.scoreKey,
      groupKey: params.group.key,
      factor,
      observations: params.observationsBySymbol[factor.symbol],
      options: params.options,
    }),
  );
  const rawContribution = factors.reduce((sum, factor) => sum + factor.contribution, 0);
  const contribution = clamp(rawContribution, params.group.minContribution, params.group.maxContribution);

  return {
    scoreKey: params.scoreKey,
    groupKey: params.group.key,
    zhName: params.group.zhName,
    enName: params.group.enName,
    minContribution: params.group.minContribution,
    maxContribution: params.group.maxContribution,
    rawContribution,
    contribution,
    capApplied: contribution !== rawContribution,
    factors,
  };
}

function isScoredFactor(factor: MacroFactorConfig): boolean {
  return (
    factor.scorePolarity !== "not_scored" &&
    factor.scorePolarity !== "context_dependent" &&
    factor.signalTransform !== "not_scored" &&
    factor.signalTransform !== "derived_ratio"
  );
}

export function calculateShadowScore(params: {
  scoreConfig: MacroScoreConfig;
  observationsBySymbol: ObservationSeriesMap;
  options?: ShadowScoreEngineOptions;
}): ShadowScoreResult {
  const { scoreConfig, observationsBySymbol, options } = params;
  const groups = scoreConfig.factorGroups.map((group) =>
    calculateShadowGroupContribution({
      scoreKey: scoreConfig.key,
      group,
      observationsBySymbol,
      options,
    }),
  );

  const rawValue = groups.reduce((sum, group) => sum + group.rawContribution, 0);
  const value = groups.reduce((sum, group) => sum + group.contribution, 0);

  if (scoreConfig.implementationStatus === "placeholder") {
    return {
      scoreKey: scoreConfig.key,
      zhName: scoreConfig.zhName,
      enName: scoreConfig.enName,
      value: 0,
      rawValue: 0,
      groups,
      status: "not_scored",
      message: "Score is configured as placeholder and is not scored.",
    };
  }

  const scoredFactors = scoreConfig.factorGroups.flatMap((group) => group.factors).filter(isScoredFactor);
  const factorResults = groups.flatMap((group) => group.factors).filter((factor) =>
    scoredFactors.some((scored) => scored.symbol === factor.symbol),
  );
  const okCount = factorResults.filter((factor) => factor.status === "ok").length;
  const status = okCount === 0 ? "no_data" : okCount === scoredFactors.length ? "ok" : "partial";

  return {
    scoreKey: scoreConfig.key,
    zhName: scoreConfig.zhName,
    enName: scoreConfig.enName,
    value,
    rawValue,
    groups,
    status,
  };
}

export function calculateAllShadowScores(params: {
  observationsBySymbol: ObservationSeriesMap;
  options?: ShadowScoreEngineOptions;
}): Record<MacroScoreKey, ShadowScoreResult> {
  return getAllMacroScoreConfigs().reduce((acc, scoreConfig) => {
    acc[scoreConfig.key] = calculateShadowScore({
      scoreConfig,
      observationsBySymbol: params.observationsBySymbol,
      options: params.options,
    });
    return acc;
  }, {} as Record<MacroScoreKey, ShadowScoreResult>);
}
