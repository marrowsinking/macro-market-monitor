import { describe, expect, test } from "vitest";
import {
  compareMacroScores,
  createScoreComparisonPayload,
  currentScoresFromMacroRegime,
} from "@/lib/debug/scoreComparisonDebugService";
import type { MacroScoreKey } from "@/lib/config/macroEngineConfig.types";
import type { ShadowScoreResult } from "@/lib/engines/shadowScoreEngine";

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

describe("scoreComparisonDebugService", () => {
  test("compareMacroScores calculates difference and absDifference", () => {
    const result = compareMacroScores({
      v1Scores: { ...allScores(0), liquidity_score: 1 },
      v2Scores: { ...allScores(0), liquidity_score: 2.5 },
    });

    expect(result.liquidity_score.difference).toBe(1.5);
    expect(result.liquidity_score.absDifference).toBe(1.5);
  });

  test("compareMacroScores detects same positive, same negative, opposite, and neutral direction", () => {
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
    expect(result.growth_score.directionAgreement).toBe("opposite");
    expect(result.risk_appetite_score.directionAgreement).toBe("both_neutral");
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

  test("createScoreComparisonPayload summarizes comparable, opposite, and largest differences", () => {
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
    expect(payload.summary.oppositeDirectionCount).toBe(2);
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
});
