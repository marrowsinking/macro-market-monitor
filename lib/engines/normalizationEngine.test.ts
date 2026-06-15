import { describe, expect, test } from "vitest";
import { getAllFactorsForScore } from "@/lib/config/macroEngineConfig";
import type { MacroFactorConfig } from "@/lib/config/macroEngineConfig.types";
import {
  calculateNormalizedSignal,
  calculateRollingStats,
  clamp,
  findPriorPointByDays,
  normalizeObservationInput,
  transformSignalSeries,
  zScoreToNormalizedSignal,
  type RawObservationPoint,
  type TransformedSignalPoint,
} from "@/lib/engines/normalizationEngine";

function factor(symbol: string, overrides: Partial<MacroFactorConfig> = {}): MacroFactorConfig {
  return {
    symbol,
    name: symbol,
    source: "FRED",
    frequency: "daily_market",
    role: "primary",
    direction: "higher_is_positive",
    scorePolarity: "higher_increases_score",
    weight: 1,
    preferredZScoreWindows: [30],
    signalTransform: "level",
    minObservations: 2,
    normalizationNote: "test",
    description: "test",
    easyModeExplanation: "test",
    ...overrides,
  };
}

function point(date: string, value: number): TransformedSignalPoint {
  return { date: new Date(`${date}T00:00:00.000Z`), value };
}

function dailyPoints(count: number, startValue = 1): RawObservationPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    date: new Date(Date.UTC(2026, 0, index + 1)),
    value: startValue + index,
  }));
}

describe("normalizationEngine", () => {
  test("normalizeObservationInput removes invalid values and invalid dates", () => {
    const result = normalizeObservationInput([
      { date: "2026-01-01", value: 1 },
      { date: "2026-01-02", value: null },
      { date: "bad-date", value: 2 },
      { date: "2026-01-03", value: Number.NaN },
      { date: "2026-01-04", value: Number.POSITIVE_INFINITY },
      { date: "2026-01-05", value: 5 },
    ]);

    expect(result.map((item) => item.value)).toEqual([1, 5]);
  });

  test("normalizeObservationInput sorts ascending and keeps the last duplicate date", () => {
    const result = normalizeObservationInput([
      { date: "2026-01-03", value: 3 },
      { date: "2026-01-01", value: 1 },
      { date: "2026-01-01", value: 10 },
      { date: "2026-01-02", value: 2 },
    ]);

    expect(result.map((item) => item.date.toISOString().slice(0, 10))).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
    expect(result.map((item) => item.value)).toEqual([10, 2, 3]);
  });

  test("findPriorPointByDays finds the nearest point at or before the lookback date", () => {
    const points = [point("2026-01-01", 1), point("2026-01-10", 10), point("2026-01-20", 20)];

    expect(findPriorPointByDays(points, new Date("2026-01-25T00:00:00.000Z"), 10)?.value).toBe(10);
    expect(findPriorPointByDays(points, new Date("2026-01-05T00:00:00.000Z"), 10)).toBeNull();
  });

  test("transformSignalSeries handles level transform", () => {
    const result = transformSignalSeries(dailyPoints(3), factor("LEVEL", { signalTransform: "level" }));

    expect(result.status).toBe("ok");
    expect(result.points.map((item) => item.value)).toEqual([1, 2, 3]);
    expect(result.latest?.value).toBe(3);
  });

  test("transformSignalSeries handles level_change transform", () => {
    const result = transformSignalSeries(
      [
        { date: "2026-01-01", value: 100 },
        { date: "2026-01-31", value: 115 },
      ],
      factor("CHANGE", { signalTransform: "level_change", transformLookbackDays: 30 }),
    );

    expect(result.status).toBe("ok");
    expect(result.points.at(-1)?.value).toBe(15);
  });

  test("transformSignalSeries handles pct_change and skips zero prior values", () => {
    const result = transformSignalSeries(
      [
        { date: "2026-01-01", value: 0 },
        { date: "2026-01-31", value: 10 },
        { date: "2026-03-02", value: 15 },
      ],
      factor("PCT", { signalTransform: "pct_change", transformLookbackDays: 30 }),
    );

    expect(result.status).toBe("ok");
    expect(result.points).toHaveLength(1);
    expect(result.points[0].value).toBe(50);
  });

  test("transformSignalSeries handles yoy_pct by prior year data and returns insufficient_data when missing", () => {
    const ok = transformSignalSeries(
      [
        { date: "2025-01-01", value: 100 },
        { date: "2026-01-01", value: 105 },
      ],
      factor("CPI", { signalTransform: "yoy_pct" }),
    );
    const insufficient = transformSignalSeries([{ date: "2026-01-01", value: 105 }], factor("CPI", { signalTransform: "yoy_pct" }));

    expect(ok.status).toBe("ok");
    expect(ok.points.at(-1)?.value).toBe(5);
    expect(insufficient.status).toBe("insufficient_data");
  });

  test("transformSignalSeries handles yoy_pct by 12 observation fallback", () => {
    const observations = Array.from({ length: 13 }, (_, index) => ({
      date: new Date(Date.UTC(2025, index, 1)),
      value: 100 + index,
    }));
    const result = transformSignalSeries(observations, factor("CPI", { signalTransform: "yoy_pct" }));

    expect(result.status).toBe("ok");
    expect(result.points.at(-1)?.value).toBe(12);
  });

  test("transformSignalSeries handles mom_change and mom_pct", () => {
    const observations = [
      { date: "2026-01-01", value: 100 },
      { date: "2026-02-01", value: 110 },
      { date: "2026-03-01", value: 121 },
    ];

    expect(transformSignalSeries(observations, factor("MOM", { signalTransform: "mom_change" })).points.map((item) => item.value)).toEqual([10, 11]);
    expect(transformSignalSeries(observations, factor("MOM", { signalTransform: "mom_pct" })).points.map((item) => item.value)).toEqual([10, 10]);
  });

  test("transformSignalSeries handles not_scored and derived_ratio", () => {
    expect(transformSignalSeries(dailyPoints(3), factor("X", { signalTransform: "not_scored" })).status).toBe("not_scored");
    const derived = transformSignalSeries(dailyPoints(3), factor("RATIO", { signalTransform: "derived_ratio" }));

    expect(derived.status).toBe("unsupported_transform");
    expect(derived.message).toContain("derived_ratio requires multiple input series");
  });

  test("calculateRollingStats calculates mean, standard deviation, zScore, and percentile", () => {
    const result = calculateRollingStats([point("2026-01-01", 1), point("2026-01-02", 2), point("2026-01-03", 3)], 10, 3);

    expect(result.status).toBe("ok");
    expect(result.mean).toBe(2);
    expect(result.standardDeviation).toBeCloseTo(Math.sqrt(2 / 3), 6);
    expect(result.zScore).toBeCloseTo((3 - 2) / Math.sqrt(2 / 3), 6);
    expect(result.percentile).toBe(100);
  });

  test("calculateRollingStats handles insufficient data and zero standard deviation", () => {
    expect(calculateRollingStats([point("2026-01-01", 1)], 10, 2).status).toBe("insufficient_data");

    const zeroStd = calculateRollingStats([point("2026-01-01", 2), point("2026-01-02", 2)], 10, 2);
    expect(zeroStd.status).toBe("invalid_data");
    expect(zeroStd.message).toBe("Cannot calculate z-score because standard deviation is zero.");
  });

  test("clamp and zScoreToNormalizedSignal map z-score to normalized signal", () => {
    expect(clamp(3, -1, 1)).toBe(1);
    expect(zScoreToNormalizedSignal(2)).toBe(1);
    expect(zScoreToNormalizedSignal(1)).toBe(0.5);
    expect(zScoreToNormalizedSignal(0)).toBe(0);
    expect(zScoreToNormalizedSignal(-1)).toBe(-0.5);
    expect(zScoreToNormalizedSignal(-2)).toBe(-1);
    expect(zScoreToNormalizedSignal(3)).toBe(1);
    expect(zScoreToNormalizedSignal(-3)).toBe(-1);
    expect(zScoreToNormalizedSignal(null)).toBeNull();
  });

  test("calculateNormalizedSignal uses config window and does not apply scorePolarity", () => {
    const vix = getAllFactorsForScore("risk_appetite_score").find((item) => item.symbol === "VIXCLS");
    if (!vix) throw new Error("Missing VIXCLS config");
    const observations = dailyPoints(40, 10);
    const result = calculateNormalizedSignal(observations, vix);

    expect(result.status).toBe("ok");
    expect(result.window).toBe(60);
    expect(result.normalizedSignal).toBeGreaterThan(0);
  });

  test("calculateNormalizedSignal supports preferredWindow override and handles not_scored", () => {
    const vix = getAllFactorsForScore("risk_appetite_score").find((item) => item.symbol === "VIXCLS");
    const china = getAllFactorsForScore("china_score")[0];
    if (!vix) throw new Error("Missing VIXCLS config");

    expect(calculateNormalizedSignal(dailyPoints(80), vix, { preferredWindow: 60 }).window).toBe(60);

    const notScored = calculateNormalizedSignal(dailyPoints(10), china);
    expect(notScored.status).toBe("insufficient_data");
    expect(notScored.normalizedSignal).toBeNull();
  });
});
