import { describe, expect, test } from "vitest";
import type { MacroScoreKey } from "@/lib/config/macroEngineConfig.types";
import {
  buildHistoricalReplayResult,
  buildReplayRow,
  buildScoreSummary,
  clampReplayParams,
  classifyReplayStability,
  countLargeMoves,
  countSaturation,
  countSignFlips,
} from "@/lib/debug/historicalReplayService";
import type { ObservationSeriesMap } from "@/lib/engines/shadowScoreEngine";

function scores(values: Partial<Record<MacroScoreKey, number | null>>) {
  return {
    liquidity_score: values.liquidity_score === undefined ? 1 : values.liquidity_score,
    inflation_score: values.inflation_score === undefined ? 1 : values.inflation_score,
    growth_score: values.growth_score === undefined ? 1 : values.growth_score,
    risk_appetite_score: values.risk_appetite_score === undefined ? 1 : values.risk_appetite_score,
    dollar_score: values.dollar_score === undefined ? 1 : values.dollar_score,
    credit_score: values.credit_score === undefined ? 1 : values.credit_score,
    commodity_score: values.commodity_score === undefined ? 1 : values.commodity_score,
    china_score: values.china_score === undefined ? 1 : values.china_score,
  };
}

describe("historicalReplayService", () => {
  test("sign flip logic ignores neutral values", () => {
    expect(countSignFlips([0.8, 0.3, -0.6, 0.1, -0.7, 0.9])).toBe(2);
  });

  test("large move count works", () => {
    expect(countLargeMoves([0, 0.5, 1.6, 0.7, -0.4])).toBe(2);
  });

  test("saturation count works", () => {
    expect(countSaturation([0, 3.5, -3.6, 3.49])).toBe(2);
  });

  test("stability classification stable watch unstable unavailable", () => {
    expect(classifyReplayStability({ availableCount: 9, signFlipCount: 0, largeMoveCount: 0, saturationCount: 0 })).toBe("unavailable");
    expect(classifyReplayStability({ availableCount: 20, signFlipCount: 2, largeMoveCount: 5, saturationCount: 3 })).toBe("stable");
    expect(classifyReplayStability({ availableCount: 20, signFlipCount: 5, largeMoveCount: 12, saturationCount: 8 })).toBe("watch");
    expect(classifyReplayStability({ availableCount: 20, signFlipCount: 6, largeMoveCount: 13, saturationCount: 0 })).toBe("unstable");
  });

  test("invalid days and step are clamped", () => {
    expect(clampReplayParams({ days: 1, step: 0 })).toEqual({ days: 30, step: 1 });
    expect(clampReplayParams({ days: 999, step: 99 })).toEqual({ days: 365, step: 10 });
  });

  test("row status is ok when all scores are available", () => {
    expect(buildReplayRow("2026-06-18", scores({})).status).toBe("ok");
  });

  test("row status is partial when some scores are unavailable", () => {
    const row = buildReplayRow("2026-06-18", scores({ china_score: null }));

    expect(row.status).toBe("partial");
    expect(row.unavailableScores).toEqual(["china_score"]);
  });

  test("row status is failed when all scores are unavailable", () => {
    const row = buildReplayRow("2026-06-18", {
      liquidity_score: null,
      inflation_score: null,
      growth_score: null,
      risk_appetite_score: null,
      dollar_score: null,
      credit_score: null,
      commodity_score: null,
      china_score: null,
    });

    expect(row.status).toBe("failed");
  });

  test("score summary handles null values", () => {
    const summary = buildScoreSummary("dollar_score", [
      buildReplayRow("2026-06-16", scores({ dollar_score: 1 })),
      buildReplayRow("2026-06-17", scores({ dollar_score: null })),
      buildReplayRow("2026-06-18", scores({ dollar_score: -1 })),
    ]);

    expect(summary.availableCount).toBe(2);
    expect(summary.missingCount).toBe(1);
    expect(summary.average).toBe(0);
    expect(summary.min).toBe(-1);
    expect(summary.max).toBe(1);
    expect(summary.latest).toBe(-1);
    expect(summary.signFlipCount).toBe(1);
  });

  test("service returns partial rows instead of crashing when one score is unavailable", () => {
    const observationsBySymbol: ObservationSeriesMap = {
      TEST: [
        { date: "2026-06-16", value: 1 },
        { date: "2026-06-17", value: 2 },
        { date: "2026-06-18", value: 3 },
      ],
    };
    const result = buildHistoricalReplayResult({
      observationsBySymbol,
      params: { days: 30, step: 10 },
      endDate: new Date("2026-06-18T00:00:00Z"),
      calculateScores: () => scores({ china_score: null }),
      generatedAt: new Date("2026-06-18T00:00:00Z"),
    });

    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.summary.partialDates).toBe(result.rows.length);
    expect(result.summary.failedDates).toBe(0);
  });

  test("service supports a custom replay date range without breaking days mode", () => {
    const observationsBySymbol: ObservationSeriesMap = {
      TEST: [
        { date: "2026-01-01", value: 1 },
        { date: "2026-01-05", value: 2 },
        { date: "2026-01-10", value: 3 },
      ],
    };
    const seenDates: string[] = [];
    const result = buildHistoricalReplayResult({
      observationsBySymbol,
      params: { startDate: "2026-01-01", endDate: "2026-01-10", step: 4 },
      generatedAt: new Date("2026-06-18T00:00:00Z"),
      calculateScores: ({ asOfDate }) => {
        seenDates.push(asOfDate);
        return scores({});
      },
    });

    expect(result.params.startDate).toBe("2026-01-01");
    expect(result.params.endDate).toBe("2026-01-10");
    expect(result.params.days).toBe(10);
    expect(seenDates).toEqual(["2026-01-01", "2026-01-05", "2026-01-09", "2026-01-10"]);
  });
});
