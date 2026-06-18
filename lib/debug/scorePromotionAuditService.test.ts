import { describe, expect, test } from "vitest";
import { macroScoreKeys } from "@/lib/config/macroEngineConfig";
import type { MacroScoreKey } from "@/lib/config/macroEngineConfig.types";
import type { DataCoverageDebugPayload } from "@/lib/debug/dataCoverageDebugService";
import type { HistoricalReplayResult, HistoricalReplayStability } from "@/lib/debug/historicalReplayService";
import type { NfciBenchmarkPayload } from "@/lib/debug/nfciBenchmarkService";
import type { DirectionAgreement, ScoreComparisonPayload } from "@/lib/debug/scoreComparisonDebugService";
import { createScorePromotionAuditPayload } from "@/lib/debug/scorePromotionAuditService";
import type { ShadowFactorContribution, ShadowScoreResult } from "@/lib/engines/shadowScoreEngine";

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

function factor(symbol: string, status: ShadowFactorContribution["status"] = "ok"): ShadowFactorContribution {
  return {
    scoreKey: "dollar_score",
    groupKey: "test",
    symbol,
    name: symbol,
    weight: 1,
    scorePolarity: status === "context_dependent" ? "context_dependent" : "higher_increases_score",
    polarityMultiplier: 1,
    normalizedSignal: status === "ok" ? 0.5 : null,
    zScore: status === "ok" ? 1 : null,
    percentile: status === "ok" ? 0.8 : null,
    rawValue: status === "ok" ? 100 : null,
    contribution: status === "ok" ? 0.5 : 0,
    status,
  };
}

function shadowScore(scoreKey: MacroScoreKey, status: ShadowScoreResult["status"] = "ok", factors: ShadowFactorContribution[] = [factor(`${scoreKey}_FACTOR`)]): ShadowScoreResult {
  return {
    scoreKey,
    zhName: scoreLabels[scoreKey],
    enName: scoreKey,
    value: status === "no_data" || status === "not_scored" ? 0 : 0.5,
    rawValue: status === "no_data" || status === "not_scored" ? 0 : 0.5,
    status,
    groups: [
      {
        scoreKey,
        groupKey: "test_group",
        zhName: "test",
        enName: "test",
        minContribution: -2,
        maxContribution: 2,
        rawContribution: factors.reduce((sum, item) => sum + item.contribution, 0),
        contribution: factors.reduce((sum, item) => sum + item.contribution, 0),
        capApplied: false,
        factors: factors.map((item) => ({ ...item, scoreKey })),
      },
    ],
  };
}

function comparisonEntry(scoreKey: MacroScoreKey, overrides: Partial<ScoreComparisonPayload["comparison"][MacroScoreKey]> = {}): ScoreComparisonPayload["comparison"][MacroScoreKey] {
  const v1Value = overrides.v1Value ?? 1;
  const v2Value = overrides.v2Value ?? 0.8;
  const difference = v1Value === null || v2Value === null ? null : v2Value - v1Value;
  const absDifference = difference === null ? null : Math.abs(difference);
  return {
    scoreKey,
    zhName: scoreLabels[scoreKey],
    enName: scoreKey,
    v1Value,
    v2Value,
    difference,
    absDifference,
    directionAgreement: overrides.directionAgreement ?? "same_positive",
    magnitudeBucket: overrides.magnitudeBucket ?? "small",
    status: overrides.status ?? "ok",
  };
}

function comparisonPayload(overrides: Partial<Record<MacroScoreKey, Partial<ScoreComparisonPayload["comparison"][MacroScoreKey]>>> = {}): ScoreComparisonPayload {
  const comparison = macroScoreKeys.reduce((acc, scoreKey) => {
    acc[scoreKey] = comparisonEntry(scoreKey, overrides[scoreKey]);
    return acc;
  }, {} as Record<MacroScoreKey, ScoreComparisonPayload["comparison"][MacroScoreKey]>);
  const scores = macroScoreKeys.reduce((acc, scoreKey) => {
    acc[scoreKey] = shadowScore(scoreKey, scoreKey === "china_score" ? "not_scored" : "ok");
    return acc;
  }, {} as Record<MacroScoreKey, ShadowScoreResult>);

  for (const scoreKey of macroScoreKeys) {
    if (overrides[scoreKey]?.v2Value === null) scores[scoreKey] = shadowScore(scoreKey, "no_data", [factor(`${scoreKey}_FACTOR`, "missing_observations")]);
  }

  return {
    generatedAt: "2026-06-18T00:00:00.000Z",
    engineVersion: "v1-v2-score-comparison-debug",
    options: { preferredWindow: null, zScoreForFullSignal: 2 },
    v1: { status: "ok", source: "test", scores: {} as ScoreComparisonPayload["v1"]["scores"] },
    v2: { status: "ok", scores },
    comparison,
    summary: {
      comparableScoreCount: 8,
      sameDirectionCount: 8,
      bothNeutralCount: 0,
      trueOppositeDirectionCount: 0,
      neutralDivergenceCount: 0,
      oppositeDirectionCount: 0,
      largeDifferenceCount: 0,
      averageAbsDifference: 0,
      largestDifferences: [],
    },
    v2Diagnostics: { missingSymbols: [], scoresWithNoData: [] },
    warnings: [],
  };
}

function coveragePayload(rows: Array<{ symbol: string; status: DataCoverageDebugPayload["rows"][number]["status"]; affectedScores: MacroScoreKey[] }>): DataCoverageDebugPayload {
  return {
    generatedAt: "2026-06-18T00:00:00.000Z",
    engineVersion: "data-coverage-debug",
    warnings: [],
    summary: {
      totalConfiguredSymbols: rows.length,
      okCount: 0,
      freshCount: rows.filter((row) => row.status === "fresh").length,
      carriedForwardCount: rows.filter((row) => row.status === "carried_forward").length,
      decayingCount: rows.filter((row) => row.status === "decaying").length,
      missingCount: rows.filter((row) => row.status === "missing").length,
      insufficientCount: rows.filter((row) => row.status === "insufficient").length,
      staleCount: rows.filter((row) => row.status === "stale").length,
      derivedCount: 0,
      placeholderCount: 0,
      notScoredCount: 0,
      highImpactIssues: [],
    },
    rows: rows.map((row) => ({
      symbol: row.symbol,
      name: row.symbol,
      source: "FRED",
      frequency: "daily_market",
      signalTransform: "level",
      minObservations: 30,
      preferredZScoreWindows: [60],
      usages: row.affectedScores.map((scoreKey) => ({ scoreKey, groupKey: "test", role: "primary", scorePolarity: "higher_increases_score", weight: 1 })),
      status: row.status,
      freshnessStatus: row.status,
      decayFactor: 1,
      freshnessMessage: row.status,
      observationCount: row.status === "missing" ? 0 : 100,
      firstDate: "2025-01-01",
      latestDate: "2026-06-17",
      daysSinceLatest: 1,
      requiredMinimumObservations: 30,
      preferredDefaultWindow: 60,
      transformLookbackDays: null,
      affectedScores: row.affectedScores,
      message: row.status,
    })),
  };
}

function nfciPayload(alignment: Partial<NfciBenchmarkPayload["alignment"]> = {}): NfciBenchmarkPayload {
  const point = {
    symbol: "NFCI" as const,
    name: "NFCI",
    latestValue: -0.5,
    zScore: null,
    latestDate: "2026-06-15",
    status: "ok" as const,
    message: null,
  };
  return {
    generatedAt: "2026-06-18T00:00:00.000Z",
    engineVersion: "nfci-benchmark-debug",
    benchmark: {
      nfci: point,
      anfci: { ...point, symbol: "ANFCI" },
      risk: { ...point, symbol: "NFCIRISK" },
      credit: { ...point, symbol: "NFCICREDIT", latestValue: -0.04 },
      leverage: { ...point, symbol: "NFCILEVERAGE" },
    },
    shadowScores: {
      liquidity_score: 0.5,
      credit_score: 0.5,
      risk_appetite_score: 0.5,
    },
    alignment: {
      liquidityVsNfci: "aligned",
      creditVsNfciCredit: "aligned",
      riskAppetiteVsNfciRisk: "aligned",
      ...alignment,
    },
    notes: [],
  };
}

function historicalReplayPayload(
  overrides: Partial<Record<MacroScoreKey, HistoricalReplayStability>> = {},
): HistoricalReplayResult {
  const scoreSummaries = macroScoreKeys.map((scoreKey) => {
    const stability = overrides[scoreKey] ?? "stable";
    const availableCount = stability === "unavailable" ? 0 : 90;
    return {
      scoreKey,
      label: scoreLabels[scoreKey],
      availableCount,
      missingCount: 90 - availableCount,
      average: stability === "unavailable" ? null : 0.5,
      min: stability === "unavailable" ? null : -0.5,
      max: stability === "unavailable" ? null : 1,
      latest: stability === "unavailable" ? null : 0.5,
      signFlipCount: stability === "unstable" ? 9 : stability === "watch" ? 3 : 0,
      largeMoveCount: stability === "unstable" ? 13 : stability === "watch" ? 6 : 0,
      saturationCount: stability === "unstable" ? 4 : 0,
      stability,
      notes: stability === "stable" ? ["Stable historical replay."] : [`Historical replay is ${stability}.`],
    };
  });

  return {
    generatedAt: "2026-06-18T00:00:00.000Z",
    engineVersion: "historical-replay-debug",
    params: {
      days: 90,
      step: 1,
      startDate: "2026-03-21",
      endDate: "2026-06-18",
    },
    summary: {
      replayDates: 90,
      successfulDates: 90,
      partialDates: 0,
      failedDates: 0,
      stableScores: scoreSummaries.filter((item) => item.stability === "stable").length,
      watchScores: scoreSummaries.filter((item) => item.stability === "watch").length,
      unstableScores: scoreSummaries.filter((item) => item.stability === "unstable").length,
      unavailableScores: scoreSummaries.filter((item) => item.stability === "unavailable").length,
      scoreSummaries,
    },
    rows: [],
    globalNotes: [],
  };
}

function row(scoreKey: MacroScoreKey, params?: Parameters<typeof createScorePromotionAuditPayload>[0]) {
  const payload = createScorePromotionAuditPayload({
    comparison: comparisonPayload(),
    dataCoverage: coveragePayload([]),
    nfciBenchmark: nfciPayload(),
    generatedAt: new Date("2026-06-18T00:00:00Z"),
    ...params,
  });
  return payload.scores.find((item) => item.scoreKey === scoreKey)!;
}

describe("scorePromotionAuditService", () => {
  test("china_score placeholder is not ready", () => {
    expect(row("china_score").decision).toBe("not_ready");
  });

  test("missing data requires data improvement", () => {
    const result = row("dollar_score", {
      dataCoverage: coveragePayload([{ symbol: "DXY", status: "missing", affectedScores: ["dollar_score"] }]),
    });

    expect(result.decision).toBe("needs_data_improvement");
    expect(result.dataHealth.status).toBe("problem");
  });

  test("stale high impact data requires data improvement", () => {
    const result = row("growth_score", {
      dataCoverage: coveragePayload([{ symbol: "PAYEMS", status: "stale", affectedScores: ["growth_score"] }]),
    });

    expect(result.decision).toBe("needs_data_improvement");
  });

  test("decaying monthly macro only is ready with monitoring", () => {
    const result = row("inflation_score", {
      dataCoverage: coveragePayload([{ symbol: "CPIAUCSL", status: "decaying", affectedScores: ["inflation_score"] }]),
    });

    expect(result.decision).toBe("ready_with_monitoring");
    expect(result.dataHealth.status).toBe("warning");
  });

  test("dollar_score healthy with same direction is ready or ready with monitoring", () => {
    expect(["ready", "ready_with_monitoring"]).toContain(row("dollar_score").decision);
  });

  test("liquidity large divergence with score-neutral NFCI needs definition audit", () => {
    const result = row("liquidity_score", {
      comparison: comparisonPayload({
        liquidity_score: { directionAgreement: "v1_positive_v2_neutral" as DirectionAgreement, magnitudeBucket: "large", absDifference: 2.5 },
      }),
      nfciBenchmark: nfciPayload({ liquidityVsNfci: "score_neutral" }),
    });

    expect(result.decision).toBe("needs_definition_audit");
  });

  test("commodity true opposite needs definition audit", () => {
    const comparison = comparisonPayload({
      commodity_score: { directionAgreement: "true_opposite", magnitudeBucket: "large", absDifference: 2.5 },
    });
    comparison.v2.scores.commodity_score = shadowScore("commodity_score", "partial", [
      factor("HG=F", "ok"),
      factor("GC=F", "context_dependent"),
      factor("GOLD_SILVER_RATIO", "context_dependent"),
    ]);

    expect(row("commodity_score", { comparison }).decision).toBe("needs_definition_audit");
  });

  test("risk_appetite aligned with NFCIRISK is a promotion candidate", () => {
    const result = row("risk_appetite_score", {
      nfciBenchmark: nfciPayload({ riskAppetiteVsNfciRisk: "aligned" }),
    });

    expect(["ready", "ready_with_monitoring"]).toContain(result.decision);
  });

  test("credit benchmark neutral is ready with monitoring", () => {
    expect(row("credit_score", { nfciBenchmark: nfciPayload({ creditVsNfciCredit: "benchmark_neutral" }) }).decision).toBe("ready_with_monitoring");
  });

  test("unavailable inputs return partial audit instead of crashing", () => {
    const payload = createScorePromotionAuditPayload({
      comparison: null,
      dataCoverage: null,
      nfciBenchmark: null,
      inputNotes: ["comparison unavailable"],
      generatedAt: new Date("2026-06-18T00:00:00Z"),
    });

    expect(payload.scores).toHaveLength(8);
    expect(payload.globalNotes).toContain("comparison unavailable");
  });

  test("summary counts match row decisions", () => {
    const payload = createScorePromotionAuditPayload({
      comparison: comparisonPayload({
        liquidity_score: { directionAgreement: "v1_positive_v2_neutral", magnitudeBucket: "large", absDifference: 2.5 },
      }),
      dataCoverage: coveragePayload([{ symbol: "DXY", status: "missing", affectedScores: ["dollar_score"] }]),
      nfciBenchmark: nfciPayload({ liquidityVsNfci: "score_neutral" }),
      generatedAt: new Date("2026-06-18T00:00:00Z"),
    });

    const counted = payload.scores.filter((item) => item.decision === "needs_data_improvement").length;
    expect(payload.summary.needsDataImprovement).toBe(counted);
    expect(payload.summary.total).toBe(8);
  });
});

describe("scorePromotionAuditService historical integration", () => {
  test("includeHistorical false returns audit without historical fields", () => {
    const payload = createScorePromotionAuditPayload({
      comparison: comparisonPayload(),
      dataCoverage: coveragePayload([]),
      nfciBenchmark: nfciPayload(),
      historicalReplay: historicalReplayPayload(),
      includeHistorical: false,
      generatedAt: new Date("2026-06-18T00:00:00Z"),
    });

    expect(payload.summary.historicalSummary?.included).toBe(false);
    expect(payload.scores.every((item) => item.historical === null)).toBe(true);
  });

  test("includeHistorical true adds historical summary", () => {
    const payload = createScorePromotionAuditPayload({
      comparison: comparisonPayload(),
      dataCoverage: coveragePayload([]),
      nfciBenchmark: nfciPayload(),
      historicalReplay: historicalReplayPayload({
        risk_appetite_score: "watch",
        liquidity_score: "unstable",
        china_score: "unavailable",
      }),
      includeHistorical: true,
      generatedAt: new Date("2026-06-18T00:00:00Z"),
    });

    expect(payload.summary.historicalSummary).toMatchObject({
      included: true,
      days: 90,
      step: 1,
      stableCount: 5,
      watchCount: 1,
      unstableCount: 1,
      unavailableCount: 1,
    });
  });

  test("stable historical evidence is attached to ready scores", () => {
    const result = row("dollar_score", {
      historicalReplay: historicalReplayPayload({ dollar_score: "stable" }),
      includeHistorical: true,
    });

    expect(result.historical?.stability).toBe("stable");
    expect(result.decision).toBe("ready");
    expect(result.reasons).toContain("Historical replay is stable over the selected period.");
  });

  test("unstable liquidity remains needs definition audit", () => {
    const result = row("liquidity_score", {
      historicalReplay: historicalReplayPayload({ liquidity_score: "unstable" }),
      includeHistorical: true,
    });

    expect(result.historical?.stability).toBe("unstable");
    expect(result.decision).toBe("needs_definition_audit");
  });

  test("unstable commodity remains needs definition audit", () => {
    const result = row("commodity_score", {
      historicalReplay: historicalReplayPayload({ commodity_score: "unstable" }),
      includeHistorical: true,
    });

    expect(result.historical?.stability).toBe("unstable");
    expect(result.decision).toBe("needs_definition_audit");
  });

  test("unavailable china remains not ready", () => {
    const result = row("china_score", {
      historicalReplay: historicalReplayPayload({ china_score: "unavailable" }),
      includeHistorical: true,
    });

    expect(result.historical?.stability).toBe("unavailable");
    expect(result.decision).toBe("not_ready");
  });

  test("watch risk appetite remains ready with monitoring", () => {
    const result = row("risk_appetite_score", {
      historicalReplay: historicalReplayPayload({ risk_appetite_score: "watch" }),
      includeHistorical: true,
    });

    expect(result.historical?.stability).toBe("watch");
    expect(result.decision).toBe("ready_with_monitoring");
  });

  test("ready score with unstable historical is downgraded to ready with monitoring", () => {
    const result = row("dollar_score", {
      historicalReplay: historicalReplayPayload({ dollar_score: "unstable" }),
      includeHistorical: true,
    });

    expect(result.historical?.stability).toBe("unstable");
    expect(result.decision).toBe("ready_with_monitoring");
  });

  test("historical replay failure returns partial audit with global notes", () => {
    const payload = createScorePromotionAuditPayload({
      comparison: comparisonPayload(),
      dataCoverage: coveragePayload([]),
      nfciBenchmark: nfciPayload(),
      historicalReplay: null,
      includeHistorical: true,
      inputNotes: ["Historical replay unavailable: timeout"],
      generatedAt: new Date("2026-06-18T00:00:00Z"),
    });

    expect(payload.scores).toHaveLength(8);
    expect(payload.globalNotes).toContain("Historical replay unavailable: timeout");
  });

  test("summary counts include historical stable watch unstable unavailable counts", () => {
    const payload = createScorePromotionAuditPayload({
      comparison: comparisonPayload(),
      dataCoverage: coveragePayload([]),
      nfciBenchmark: nfciPayload(),
      historicalReplay: historicalReplayPayload({
        risk_appetite_score: "watch",
        liquidity_score: "unstable",
        commodity_score: "unstable",
        china_score: "unavailable",
      }),
      includeHistorical: true,
      generatedAt: new Date("2026-06-18T00:00:00Z"),
    });

    expect(payload.summary.historicalSummary).toMatchObject({
      stableCount: 4,
      watchCount: 1,
      unstableCount: 2,
      unavailableCount: 1,
    });
  });
});
