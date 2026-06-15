import { describe, expect, test } from "vitest";
import {
  compareMacroScores,
  createScoreComparisonPayload,
  currentScoresFromMacroRegime,
} from "@/lib/debug/scoreComparisonDebugService";
import type { MacroScoreKey } from "@/lib/config/macroEngineConfig.types";
import type { ObservationSeriesMap } from "@/lib/engines/shadowScoreEngine";
import type { ShadowFactorContribution, ShadowScoreResult } from "@/lib/engines/shadowScoreEngine";

const scoreKeys: MacroScoreKey[] = [
  "liquidity_score",
  "inflation_score",
  "growth_score",
  "risk_appetite_score",
  "dollar_score",
  "credit_score",
  "commodity_score",
  "china_score",
];

function allScores(value: number | null): Record<MacroScoreKey, number | null> {
  return Object.fromEntries(scoreKeys.map((key) => [key, value])) as Record<MacroScoreKey, number | null>;
}

function shadowScores(values: Record<MacroScoreKey, number | null>): Record<MacroScoreKey, ShadowScoreResult> {
  return scoreKeys.reduce((acc, key) => {
    acc[key] = {
      scoreKey: key,
      zhName: key,
      enName: key,
      value: values[key] ?? 0,
      rawValue: values[key] ?? 0,
      groups: [],
      status: values[key] === null ? "no_data" : key === "china_score" ? "not_scored" : "ok",
    };
    return acc;
  }, {} as Record<MacroScoreKey, ShadowScoreResult>);
}

function factor(params: Partial<ShadowFactorContribution> & { symbol: string; status: ShadowFactorContribution["status"] }): ShadowFactorContribution {
  const { symbol, status, ...rest } = params;
  return {
    scoreKey: "commodity_score",
    groupKey: "growth_led_commodities",
    symbol,
    name: symbol,
    weight: 1,
    scorePolarity: "higher_increases_score",
    polarityMultiplier: 1,
    normalizedSignal: null,
    zScore: null,
    percentile: null,
    rawValue: null,
    contribution: 0,
    status,
    message: params.message,
    ...rest,
  };
}

function commodityScoreWithDiagnostics(): ShadowScoreResult {
  return {
    scoreKey: "commodity_score",
    zhName: "商品週期",
    enName: "Commodity Cycle",
    value: 0,
    rawValue: 0,
    status: "no_data",
    groups: [
      {
        scoreKey: "commodity_score",
        groupKey: "growth_led_commodities",
        zhName: "成長型商品",
        enName: "Growth-led Commodities",
        minContribution: -2,
        maxContribution: 2,
        rawContribution: 0,
        contribution: 0,
        capApplied: false,
        factors: [
          factor({ symbol: "HG=F", status: "missing_observations", message: "Missing observations." }),
          factor({ symbol: "DCOILWTICO", status: "insufficient_data", message: "Insufficient observations.", rawValue: 71.5 }),
        ],
      },
      {
        scoreKey: "commodity_score",
        groupKey: "defensive_precious_metals",
        zhName: "防守型貴金屬",
        enName: "Defensive Precious Metals",
        minContribution: -0.5,
        maxContribution: 0.5,
        rawContribution: 0,
        contribution: 0,
        capApplied: false,
        factors: [
          factor({ symbol: "GC=F", status: "context_dependent", scorePolarity: "context_dependent", polarityMultiplier: 0, message: "Tracked but not scored." }),
          factor({ symbol: "SI=F", status: "context_dependent", scorePolarity: "context_dependent", polarityMultiplier: 0 }),
          factor({ symbol: "GOLD_SILVER_RATIO", status: "unsupported_transform", scorePolarity: "context_dependent", polarityMultiplier: 0, message: "derived_ratio requires multiple input series." }),
        ],
      },
    ],
  };
}

describe("scoreComparisonDebugService", () => {
  test("compareMacroScores calculates difference and absDifference", () => {
    const result = compareMacroScores({
      v1Scores: { ...allScores(0), liquidity_score: 1 },
      v2Scores: { ...allScores(0), liquidity_score: 2.5 },
    });

    expect(result.liquidity_score.difference).toBe(1.5);
    expect(result.liquidity_score.absDifference).toBe(1.5);
  });

  test("compareMacroScores detects same positive, same negative, true opposite, and neutral direction", () => {
    const result = compareMacroScores({
      v1Scores: {
        ...allScores(0),
        liquidity_score: 1,
        inflation_score: -1,
        growth_score: 1,
        risk_appetite_score: 0.1,
      },
      v2Scores: {
        ...allScores(0),
        liquidity_score: 2,
        inflation_score: -2,
        growth_score: -1,
        risk_appetite_score: -0.1,
      },
    });

    expect(result.liquidity_score.directionAgreement).toBe("same_positive");
    expect(result.inflation_score.directionAgreement).toBe("same_negative");
    expect(result.growth_score.directionAgreement).toBe("true_opposite");
    expect(result.risk_appetite_score.directionAgreement).toBe("both_neutral");
  });

  test("compareMacroScores separates positive or negative versus neutral divergence from true opposite", () => {
    const result = compareMacroScores({
      v1Scores: {
        ...allScores(0),
        liquidity_score: 2.5,
        inflation_score: -2.5,
        growth_score: 0,
        risk_appetite_score: 0,
      },
      v2Scores: {
        ...allScores(0),
        liquidity_score: 0.1,
        inflation_score: -0.1,
        growth_score: 0.36,
        risk_appetite_score: -0.36,
      },
    });

    expect(result.liquidity_score.directionAgreement).toBe("v1_positive_v2_neutral");
    expect(result.inflation_score.directionAgreement).toBe("v1_negative_v2_neutral");
    expect(result.growth_score.directionAgreement).toBe("v1_neutral_v2_positive");
    expect(result.risk_appetite_score.directionAgreement).toBe("v1_neutral_v2_negative");
  });

  test("compareMacroScores keeps positive-negative and negative-positive as true opposite", () => {
    const result = compareMacroScores({
      v1Scores: { ...allScores(0), liquidity_score: 2, inflation_score: -1.5 },
      v2Scores: { ...allScores(0), liquidity_score: -1, inflation_score: 0.8 },
    });

    expect(result.liquidity_score.directionAgreement).toBe("true_opposite");
    expect(result.inflation_score.directionAgreement).toBe("true_opposite");
  });

  test("compareMacroScores marks missing v1 or v2 status", () => {
    const result = compareMacroScores({
      v1Scores: { ...allScores(0), liquidity_score: null, inflation_score: 1 },
      v2Scores: { ...allScores(0), liquidity_score: 1, inflation_score: null },
    });

    expect(result.liquidity_score.status).toBe("missing_v1");
    expect(result.inflation_score.status).toBe("missing_v2");
    expect(result.liquidity_score.directionAgreement).toBe("unavailable");
  });

  test("compareMacroScores assigns small medium and large magnitude buckets", () => {
    const result = compareMacroScores({
      v1Scores: { ...allScores(0), liquidity_score: 0, inflation_score: 0, growth_score: 0 },
      v2Scores: { ...allScores(0), liquidity_score: 0.5, inflation_score: 1.5, growth_score: 2 },
    });

    expect(result.liquidity_score.magnitudeBucket).toBe("small");
    expect(result.inflation_score.magnitudeBucket).toBe("medium");
    expect(result.growth_score.magnitudeBucket).toBe("large");
  });

  test("createScoreComparisonPayload summarizes comparable, same, neutral divergence, true opposite, and largest differences", () => {
    const v1Scores = { ...allScores(0), liquidity_score: 1, inflation_score: 1, growth_score: 0 };
    const v2Scores = { ...allScores(0), liquidity_score: 3.5, inflation_score: -1, growth_score: 0.5 };
    const payload = createScoreComparisonPayload({
      v1: { status: "ok", source: "test", scores: currentScoresFromMacroRegime(v1Scores) },
      v2Scores: shadowScores(v2Scores),
      options: { preferredWindow: null, zScoreForFullSignal: 2 },
      warnings: [],
      generatedAt: new Date("2026-01-02T03:04:05Z"),
    });

    expect(Object.keys(payload.comparison)).toHaveLength(8);
    expect(payload.summary.comparableScoreCount).toBe(8);
    expect(payload.summary.sameDirectionCount).toBe(1);
    expect(payload.summary.bothNeutralCount).toBe(5);
    expect(payload.summary.neutralDivergenceCount).toBe(1);
    expect(payload.summary.trueOppositeDirectionCount).toBe(1);
    expect(payload.summary.largeDifferenceCount).toBe(2);
    expect(payload.summary.averageAbsDifference).toBeGreaterThan(0);
    expect(payload.summary.largestDifferences[0].scoreKey).toBe("liquidity_score");
    expect(payload.generatedAt).toBe("2026-01-02T03:04:05.000Z");
  });

  test("createScoreComparisonPayload does not crash when v1 is unavailable", () => {
    const payload = createScoreComparisonPayload({
      v1: { status: "unavailable", source: "MacroRegime.latest", scores: currentScoresFromMacroRegime(allScores(null)) },
      v2Scores: shadowScores(allScores(1)),
      options: { preferredWindow: null, zScoreForFullSignal: 2 },
      warnings: ["Failed to load current v1 scores."],
    });

    expect(payload.v1.status).toBe("unavailable");
    expect(payload.comparison.liquidity_score.status).toBe("missing_v1");
    expect(payload.summary.comparableScoreCount).toBe(0);
    expect(payload.warnings).toContain("Failed to load current v1 scores.");
  });

  test("createScoreComparisonPayload does not count missing v2 as true opposite", () => {
    const payload = createScoreComparisonPayload({
      v1: { status: "ok", source: "test", scores: currentScoresFromMacroRegime({ ...allScores(0), commodity_score: 2 }) },
      v2Scores: { ...shadowScores(allScores(0)), commodity_score: { ...shadowScores(allScores(null)).commodity_score, status: "no_data" } },
    });

    expect(payload.comparison.commodity_score.status).toBe("missing_v2");
    expect(payload.summary.trueOppositeDirectionCount).toBe(0);
  });

  test("createScoreComparisonPayload exposes v2 diagnostics for missing, insufficient, unsupported, and context-dependent factors", () => {
    const v2Scores = { ...shadowScores(allScores(0)), commodity_score: commodityScoreWithDiagnostics() };
    const observationsBySymbol: ObservationSeriesMap = {
      DCOILWTICO: [
        { date: "2026-01-01", value: 70 },
        { date: "2026-01-03", value: 71.5 },
      ],
      "GC=F": [{ date: "2026-01-02", value: 2100 }],
    };
    const payload = createScoreComparisonPayload({
      v1: { status: "ok", source: "test", scores: currentScoresFromMacroRegime(allScores(0)) },
      v2Scores,
      observationsBySymbol,
    });

    const commodity = payload.v2Diagnostics.scoresWithNoData.find((score) => score.scoreKey === "commodity_score");
    expect(commodity?.missingSymbols).toEqual(["HG=F"]);
    expect(commodity?.insufficientDataSymbols).toEqual(["DCOILWTICO"]);
    expect(commodity?.unsupportedSymbols).toEqual(["GOLD_SILVER_RATIO"]);
    expect(commodity?.contextDependentSymbols).toEqual(["GC=F", "SI=F"]);
    expect(commodity?.factors.find((item) => item.symbol === "DCOILWTICO")).toMatchObject({
      observationCount: 2,
      latestDate: "2026-01-03",
      signalTransform: "pct_change",
      transformLookbackDays: 30,
      minObservations: 30,
      rawValue: 71.5,
    });
    expect(commodity?.factors.find((item) => item.symbol === "GOLD_SILVER_RATIO")).toMatchObject({
      status: "unsupported_transform",
      signalTransform: "derived_ratio",
    });
  });
});
