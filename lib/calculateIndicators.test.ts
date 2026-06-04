import { describe, expect, test } from "vitest";
import type { IndicatorWithObservations } from "@/lib/calculateIndicators";
import { calculateIndicatorStats } from "@/lib/calculateIndicators";

function indicator(values: Array<[string, number]>): IndicatorWithObservations {
  return {
    id: 1,
    name: "Test Indicator",
    symbol: "TEST",
    category: "test",
    source: "test",
    fredSeriesId: null,
    frequency: "daily",
    description: "",
    macroLogic: "test logic",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    observations: values.map(([date, value], index) => ({
      id: index + 1,
      indicatorId: 1,
      date: new Date(`${date}T00:00:00.000Z`),
      value,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    })),
  };
}

describe("calculateIndicatorStats", () => {
  test("uses latest, previous, and closest available prior observations for changes", () => {
    const stats = calculateIndicatorStats(
      indicator([
        ["2026-01-01", 100],
        ["2026-01-15", 110],
        ["2026-02-01", 120],
        ["2026-03-01", 130],
        ["2026-04-01", 140],
      ]),
    );

    expect(stats.latestValue).toBe(140);
    expect(stats.previousValue).toBe(130);
    expect(stats.change1d).toBe(10);
    expect(stats.change7d).toBe(10);
    expect(stats.change30d).toBe(10);
    expect(stats.change90d).toBe(40);
    expect(stats.trend).toBe("rising");
  });

  test("uses only the latest one year of data for zScore and percentile", () => {
    const stats = calculateIndicatorStats(
      indicator([
        ["2024-01-01", 1000],
        ["2025-07-01", 10],
        ["2026-01-01", 20],
        ["2026-06-01", 30],
      ]),
    );

    expect(stats.zScore).toBeCloseTo(1.2247, 4);
    expect(stats.percentile).toBeCloseTo(100);
  });

  test("returns null and insufficient_data when there is not enough history", () => {
    const stats = calculateIndicatorStats(indicator([["2026-06-01", 30]]));

    expect(stats.previousValue).toBeNull();
    expect(stats.change1d).toBeNull();
    expect(stats.change7d).toBeNull();
    expect(stats.change30d).toBeNull();
    expect(stats.change90d).toBeNull();
    expect(stats.zScore).toBeNull();
    expect(stats.percentile).toBeNull();
    expect(stats.trend).toBe("insufficient_data");
  });

  test("marks falling when both 30d and 90d changes are negative, otherwise mixed", () => {
    expect(
      calculateIndicatorStats(
        indicator([
          ["2026-01-01", 150],
          ["2026-03-01", 130],
          ["2026-04-01", 120],
        ]),
      ).trend,
    ).toBe("falling");

    expect(
      calculateIndicatorStats(
        indicator([
          ["2026-01-01", 100],
          ["2026-03-01", 150],
          ["2026-04-01", 120],
        ]),
      ).trend,
    ).toBe("mixed");
  });
});
