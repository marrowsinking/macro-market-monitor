import { describe, expect, test } from "vitest";
import type { IndicatorStats } from "@/lib/calculateIndicators";
import { getActiveIndicatorCoverage, getInitialConfirmedRegimeState, getScoreChanges } from "@/lib/dashboard/dashboardViewModel";

function stat(symbol: string, source: string, latestValue: number | null): IndicatorStats {
  return {
    indicator: {
      id: 1,
      name: symbol,
      symbol,
      category: source === "PLACEHOLDER" ? "中國" : "利率",
      source,
      fredSeriesId: null,
      frequency: "daily",
      description: "",
      macroLogic: "",
      createdAt: new Date(),
      updatedAt: new Date(),
      observations: [],
    },
    latestValue,
    latestDate: latestValue === null ? null : new Date(),
    previousValue: null,
    change1d: null,
    change7d: null,
    change30d: null,
    change90d: null,
    zScore: null,
    percentile: null,
    trend: "insufficient_data",
    macroMeaning: "",
  };
}

describe("getActiveIndicatorCoverage", () => {
  test("calculates coverage from active indicators only", () => {
    const coverage = getActiveIndicatorCoverage([
      stat("DGS10", "FRED", 4.5),
      stat("DGS2", "FRED", null),
      stat("CHINA_PMI", "PLACEHOLDER", null),
      stat("DXY", "PLACEHOLDER", null),
    ]);

    expect(coverage).toEqual({
      activeIndicatorCount: 2,
      activeIndicatorsWithDataCount: 1,
    });
  });
});

describe("getScoreChanges", () => {
  test("compares current and previous macro regime scores", () => {
    const current = {
      finalRegime: "避險模式",
      summary: "",
      liquidityScore: -1,
      inflationScore: 3,
      growthScore: 1,
      riskAppetiteScore: 0,
      dollarScore: 4.5,
      creditScore: -1,
      commodityScore: 0,
      chinaScore: 0,
    };
    const previous = {
      ...current,
      finalRegime: "風險偏好模式",
      riskAppetiteScore: 4,
      dollarScore: 2.5,
      creditScore: 3,
    };

    const changes = getScoreChanges(current, previous);

    expect(changes.riskAppetiteScore).toEqual({ previous: 4, current: 0, change: -4 });
    expect(changes.dollarScore).toEqual({ previous: 2.5, current: 4.5, change: 2 });
    expect(changes.creditScore).toEqual({ previous: 3, current: -1, change: -4 });
  });
});

describe("getInitialConfirmedRegimeState", () => {
  test("returns the confirmedRegimeState shape used by dashboardViewModel", () => {
    const state = getInitialConfirmedRegimeState("風險偏好模式");

    expect(state.confirmedRegime).toBe("風險偏好模式");
    expect(state.rawRegimeSignal).toBe("風險偏好模式");
    expect(state.pendingRegime).toBeNull();
    expect(state.pendingConfirmationDays).toBe(0);
    expect(state.requiredConfirmationDays).toBe(3);
    expect(state.daysInConfirmedRegime).toBe(1);
    expect(state.confidence).toBe("medium");
  });
});
