import { macroScoreKeys } from "@/lib/config/macroEngineConfig";
import type { MacroScoreKey } from "@/lib/config/macroEngineConfig.types";
import type { CoverageRow, DataCoverageDebugPayload } from "@/lib/debug/dataCoverageDebugService";
import type { NfciAlignment, NfciBenchmarkPayload } from "@/lib/debug/nfciBenchmarkService";
import type { DirectionAgreement, ScoreComparisonPayload } from "@/lib/debug/scoreComparisonDebugService";
import type { ShadowFactorContribution, ShadowScoreResult } from "@/lib/engines/shadowScoreEngine";

export type PromotionDecision =
  | "ready"
  | "ready_with_monitoring"
  | "needs_definition_audit"
  | "needs_data_improvement"
  | "not_ready";

export type ScorePromotionAuditResult = {
  generatedAt: string;
  engineVersion: "score-promotion-audit-debug";
  summary: {
    total: number;
    ready: number;
    readyWithMonitoring: number;
    needsDefinitionAudit: number;
    needsDataImprovement: number;
    notReady: number;
  };
  scores: ScorePromotionAuditRow[];
  globalNotes: string[];
};

export type ScorePromotionAuditRow = {
  scoreKey: MacroScoreKey;
  label: string;
  decision: PromotionDecision;
  confidence: "high" | "medium" | "low";
  v1: number | null;
  v2: number | null;
  difference: number | null;
  directionAgreement: DirectionAgreement | null;
  dataHealth: {
    status: "healthy" | "warning" | "problem";
    missingCount: number;
    insufficientCount: number;
    staleCount: number;
    decayingCount: number;
    carriedForwardCount: number;
    affectedSymbols: string[];
  };
  benchmark: {
    name: string;
    alignment: NfciAlignment;
    benchmarkValue: number | null;
    note: string;
  } | null;
  factorHealth: {
    scoredFactorCount: number;
    contextDependentCount: number;
    notScoredCount: number;
    unavailableFactorCount: number;
    notes: string[];
  };
  reasons: string[];
  blockers: string[];
  recommendedNextAction: string;
};

type AuditInput = {
  comparison?: ScoreComparisonPayload | null;
  dataCoverage?: DataCoverageDebugPayload | null;
  nfciBenchmark?: NfciBenchmarkPayload | null;
  inputNotes?: string[];
  generatedAt?: Date;
};

const scoreLabels: Record<MacroScoreKey, string> = {
  liquidity_score: "流動性",
  inflation_score: "通脹壓力",
  growth_score: "增長",
  risk_appetite_score: "風險偏好",
  dollar_score: "美元壓力",
  credit_score: "信用環境",
  commodity_score: "商品週期",
  china_score: "中國宏觀",
};

const benchmarkByScore: Partial<Record<MacroScoreKey, (payload: NfciBenchmarkPayload) => ScorePromotionAuditRow["benchmark"]>> = {
  liquidity_score: (payload) => ({
    name: "Liquidity vs -NFCI",
    alignment: payload.alignment.liquidityVsNfci,
    benchmarkValue: payload.benchmark.nfci.latestValue,
    note: "Liquidity score should generally align with inverted NFCI because positive NFCI means tighter conditions.",
  }),
  credit_score: (payload) => ({
    name: "Credit vs -NFCICREDIT",
    alignment: payload.alignment.creditVsNfciCredit,
    benchmarkValue: payload.benchmark.credit.latestValue,
    note: "Credit score should generally align with inverted NFCICREDIT.",
  }),
  risk_appetite_score: (payload) => ({
    name: "Risk Appetite vs -NFCIRISK",
    alignment: payload.alignment.riskAppetiteVsNfciRisk,
    benchmarkValue: payload.benchmark.risk.latestValue,
    note: "Risk appetite score should generally align with inverted NFCIRISK.",
  }),
};

function round(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Number(value.toFixed(6));
}

function coverageRowsForScore(scoreKey: MacroScoreKey, dataCoverage?: DataCoverageDebugPayload | null): CoverageRow[] {
  return dataCoverage?.rows.filter((row) => row.affectedScores.includes(scoreKey)) ?? [];
}

function dataHealth(scoreKey: MacroScoreKey, dataCoverage?: DataCoverageDebugPayload | null): ScorePromotionAuditRow["dataHealth"] {
  const rows = coverageRowsForScore(scoreKey, dataCoverage);
  const missing = rows.filter((row) => row.status === "missing");
  const insufficient = rows.filter((row) => row.status === "insufficient");
  const stale = rows.filter((row) => row.status === "stale");
  const decaying = rows.filter((row) => row.status === "decaying");
  const carried = rows.filter((row) => row.status === "carried_forward");
  const problemRows = [...missing, ...insufficient, ...stale];
  const warningRows = [...decaying, ...carried];
  const affectedSymbols = [...problemRows, ...warningRows].map((row) => row.symbol).sort();

  return {
    status: problemRows.length > 0 ? "problem" : warningRows.length > 0 ? "warning" : "healthy",
    missingCount: missing.length,
    insufficientCount: insufficient.length,
    staleCount: stale.length,
    decayingCount: decaying.length,
    carriedForwardCount: carried.length,
    affectedSymbols,
  };
}

function factorHealth(score?: ShadowScoreResult): ScorePromotionAuditRow["factorHealth"] {
  const factors = score?.groups.flatMap((group) => group.factors) ?? [];
  const unavailableStatuses: ShadowFactorContribution["status"][] = [
    "missing_observations",
    "insufficient_data",
    "invalid_data",
    "unsupported_transform",
  ];
  const unavailable = factors.filter((factor) => unavailableStatuses.includes(factor.status));
  const contextDependent = factors.filter((factor) => factor.status === "context_dependent");
  const notScored = factors.filter((factor) => factor.status === "not_scored");
  const ok = factors.filter((factor) => factor.status === "ok");
  const notes: string[] = [];

  if (contextDependent.length > 0) notes.push(`Context-dependent factors: ${contextDependent.map((factor) => factor.symbol).sort().join(", ")}`);
  if (unavailable.length > 0) notes.push(`Unavailable factors: ${unavailable.map((factor) => factor.symbol).sort().join(", ")}`);
  if (notScored.length > 0) notes.push(`Not-scored factors: ${notScored.map((factor) => factor.symbol).sort().join(", ")}`);

  return {
    scoredFactorCount: ok.length,
    contextDependentCount: contextDependent.length,
    notScoredCount: notScored.length,
    unavailableFactorCount: unavailable.length,
    notes,
  };
}

function isNeutralDivergence(direction: DirectionAgreement | null): boolean {
  return (
    direction === "v1_positive_v2_neutral" ||
    direction === "v1_negative_v2_neutral" ||
    direction === "v1_neutral_v2_positive" ||
    direction === "v1_neutral_v2_negative"
  );
}

function isSameDirection(direction: DirectionAgreement | null): boolean {
  return direction === "same_positive" || direction === "same_negative" || direction === "both_neutral";
}

function benchmarkForScore(scoreKey: MacroScoreKey, nfciBenchmark?: NfciBenchmarkPayload | null): ScorePromotionAuditRow["benchmark"] {
  const factory = benchmarkByScore[scoreKey];
  if (!factory || !nfciBenchmark) return null;
  return factory(nfciBenchmark);
}

function recommendedAction(decision: PromotionDecision, scoreKey: MacroScoreKey): string {
  if (scoreKey === "china_score") return "Connect real China macro data sources before promotion.";
  if (scoreKey === "commodity_score" && decision === "needs_definition_audit") {
    return "Decide whether commodity_score means growth-sensitive commodity cycle or broad commodity/inflation hedge basket.";
  }
  if (decision === "needs_data_improvement") return "Improve missing, insufficient, or stale data before considering promotion.";
  if (decision === "needs_definition_audit") return "Review factor definition, benchmark alignment, and v1/v2 divergence before promotion.";
  if (decision === "ready") return "Candidate is ready for controlled promotion planning.";
  return "Keep as v2 candidate and monitor the next data refresh cycles.";
}

function decideScore(params: {
  scoreKey: MacroScoreKey;
  comparisonEntry?: ScoreComparisonPayload["comparison"][MacroScoreKey];
  shadowScore?: ShadowScoreResult;
  dataHealth: ScorePromotionAuditRow["dataHealth"];
  factorHealth: ScorePromotionAuditRow["factorHealth"];
  benchmark: ScorePromotionAuditRow["benchmark"];
}): Pick<ScorePromotionAuditRow, "decision" | "confidence" | "reasons" | "blockers" | "recommendedNextAction"> {
  const { scoreKey, comparisonEntry, shadowScore, dataHealth: health, factorHealth: factors, benchmark } = params;
  const direction = comparisonEntry?.directionAgreement ?? null;
  const largeDifference = (comparisonEntry?.absDifference ?? 0) >= 2 || comparisonEntry?.magnitudeBucket === "large";
  const reasons: string[] = [];
  const blockers: string[] = [];
  let decision: PromotionDecision = "ready_with_monitoring";
  let confidence: "high" | "medium" | "low" = "medium";

  if (scoreKey === "china_score") {
    reasons.push("China macro indicators are placeholders and not included in scored regime logic.");
    return {
      decision: "not_ready",
      confidence: "high",
      reasons,
      blockers: ["China score is not backed by connected macro data."],
      recommendedNextAction: recommendedAction("not_ready", scoreKey),
    };
  }

  if (health.status === "problem") {
    blockers.push("Data health has missing, insufficient, or stale required symbols.");
    decision = "needs_data_improvement";
    confidence = "high";
  } else if (health.status === "warning") {
    reasons.push("Data health has only decaying or carried-forward low-frequency data; this is monitorable but not a blocker.");
  } else {
    reasons.push("Required data health is acceptable.");
  }

  if (!shadowScore || shadowScore.status === "no_data" || comparisonEntry?.v2Value === null || comparisonEntry?.status === "missing_v2") {
    blockers.push("V2 shadow score is unavailable.");
    decision = "needs_data_improvement";
    confidence = "high";
  }

  if (factors.unavailableFactorCount > 0) {
    blockers.push("One or more v2 factors are unavailable.");
    decision = "needs_data_improvement";
    confidence = "high";
  }

  if (scoreKey === "commodity_score" && (direction === "true_opposite" || factors.contextDependentCount > 0)) {
    blockers.push("Commodity score mixes growth-sensitive commodities with context-dependent defensive metals.");
    decision = decision === "needs_data_improvement" ? decision : "needs_definition_audit";
    confidence = decision === "needs_data_improvement" ? confidence : "medium";
  }

  if (scoreKey === "liquidity_score" && (direction === "true_opposite" || (largeDifference && isNeutralDivergence(direction)) || benchmark?.alignment === "score_neutral" || benchmark?.alignment === "divergent")) {
    blockers.push("Liquidity score needs definition audit against NFCI benchmark and v1/v2 divergence.");
    decision = decision === "needs_data_improvement" ? decision : "needs_definition_audit";
    confidence = decision === "needs_data_improvement" ? confidence : "medium";
  }

  if (benchmark?.alignment === "divergent" && scoreKey !== "liquidity_score") {
    blockers.push(`${benchmark.name} is divergent.`);
    decision = decision === "needs_data_improvement" ? decision : "needs_definition_audit";
  } else if (benchmark && ["aligned", "benchmark_neutral", "score_neutral", "both_neutral", "mixed"].includes(benchmark.alignment)) {
    reasons.push(`${benchmark.name} provides ${benchmark.alignment} evidence.`);
  }

  if (direction === "true_opposite" && !["commodity_score", "liquidity_score"].includes(scoreKey) && decision === "ready_with_monitoring") {
    reasons.push("V1 and v2 are truly opposite, so promotion requires monitoring rather than immediate trust.");
    decision = "needs_definition_audit";
  }

  if (scoreKey === "dollar_score" && health.status === "healthy" && shadowScore?.status === "ok" && direction !== "true_opposite") {
    decision = largeDifference || isNeutralDivergence(direction) ? "ready_with_monitoring" : "ready";
    confidence = "medium";
    reasons.push("Dollar score has healthy core data and no true opposite direction.");
  }

  if (scoreKey === "credit_score" && decision === "ready_with_monitoring" && benchmark?.alignment === "benchmark_neutral") {
    reasons.push("Credit benchmark is neutral; v2 can be monitored without treating v1 saturation as a blocker.");
  }

  if (scoreKey === "risk_appetite_score" && decision === "ready_with_monitoring" && benchmark?.alignment === "aligned") {
    reasons.push("Risk appetite aligns with NFCIRISK benchmark.");
  }

  if ((scoreKey === "inflation_score" || scoreKey === "growth_score") && health.status === "warning" && decision === "ready_with_monitoring") {
    reasons.push("Monthly macro data are usable under carry-forward/decay diagnostics, but should be monitored until next release.");
  }

  if (largeDifference && decision === "ready_with_monitoring") {
    reasons.push("V1/v2 magnitude difference is large and should be monitored.");
  }
  if (isSameDirection(direction) && decision === "ready_with_monitoring") {
    reasons.push("V1 and v2 have compatible direction.");
  }

  return {
    decision,
    confidence,
    reasons: reasons.length > 0 ? reasons : ["No blocking audit issue detected."],
    blockers,
    recommendedNextAction: recommendedAction(decision, scoreKey),
  };
}

export function createScorePromotionAuditPayload(params: AuditInput): ScorePromotionAuditResult {
  const globalNotes = [...(params.inputNotes ?? [])];
  if (!params.comparison) globalNotes.push("Score comparison input unavailable; generated partial audit.");
  if (!params.dataCoverage) globalNotes.push("Data coverage input unavailable; data health marked from available inputs only.");
  if (!params.nfciBenchmark) globalNotes.push("NFCI benchmark input unavailable; benchmark evidence omitted.");

  const scores = macroScoreKeys.map((scoreKey): ScorePromotionAuditRow => {
    const comparisonEntry = params.comparison?.comparison[scoreKey];
    const shadowScore = params.comparison?.v2.scores[scoreKey];
    const health = dataHealth(scoreKey, params.dataCoverage);
    const factors = factorHealth(shadowScore);
    const benchmark = benchmarkForScore(scoreKey, params.nfciBenchmark);
    const decision = decideScore({
      scoreKey,
      comparisonEntry,
      shadowScore,
      dataHealth: health,
      factorHealth: factors,
      benchmark,
    });

    return {
      scoreKey,
      label: scoreLabels[scoreKey],
      decision: decision.decision,
      confidence: decision.confidence,
      v1: round(comparisonEntry?.v1Value),
      v2: round(comparisonEntry?.v2Value),
      difference: round(comparisonEntry?.difference),
      directionAgreement: comparisonEntry?.directionAgreement ?? null,
      dataHealth: health,
      benchmark,
      factorHealth: factors,
      reasons: decision.reasons,
      blockers: decision.blockers,
      recommendedNextAction: decision.recommendedNextAction,
    };
  });

  return {
    generatedAt: (params.generatedAt ?? new Date()).toISOString(),
    engineVersion: "score-promotion-audit-debug",
    summary: {
      total: scores.length,
      ready: scores.filter((row) => row.decision === "ready").length,
      readyWithMonitoring: scores.filter((row) => row.decision === "ready_with_monitoring").length,
      needsDefinitionAudit: scores.filter((row) => row.decision === "needs_definition_audit").length,
      needsDataImprovement: scores.filter((row) => row.decision === "needs_data_improvement").length,
      notReady: scores.filter((row) => row.decision === "not_ready").length,
    },
    scores,
    globalNotes,
  };
}
