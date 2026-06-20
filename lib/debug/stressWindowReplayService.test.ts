import { describe, expect, test } from "vitest";
import type { MacroScoreKey } from "@/lib/config/macroEngineConfig.types";
import type {
  HistoricalReplayResult,
  HistoricalReplayStability,
} from "@/lib/debug/historicalReplayService";
import {
  buildStressWindowReplayResult,
  clampStressWindowStep,
  resolveStressWindows,
  STRESS_WINDOWS,
} from "@/lib/debug/stressWindowReplayService";
import type { ObservationSeriesMap } from "@/lib/engines/shadowScoreEngine";

const allScoreKeys: MacroScoreKey[] = [
  "liquidity_score",
  "inflation_score",
  "growth_score",
  "risk_appetite_score",
  "dollar_score",
  "credit_score",
  "commodity_score",
  "china_score",
];

function replayResult(params: {
  startDate: string;
  endDate: string;
  stability?: Partial<Record<MacroScoreKey, HistoricalReplayStability>>;
  availableCount?: Partial<Record<MacroScoreKey, number>>;
  partialDates?: number;
}): HistoricalReplayResult {
  const scoreSummaries = allScoreKeys.map((scoreKey) => {
    const stability = params.stability?.[scoreKey] ?? "stable";
    const availableCount = params.availableCount?.[scoreKey] ?? 12;
    return {
      scoreKey,
      label: scoreKey,
      availableCount,
      missingCount: stability === "unavailable" ? 12 : 0,
      average: stability === "unavailable" ? null : 1,
      min: stability === "unavailable" ? null : 0,
      max: stability === "unavailable" ? null : 2,
      latest: stability === "unavailable" ? null : 1,
      signFlipCount: stability === "unstable" ? 6 : 0,
      largeMoveCount: stability === "unstable" ? 13 : 0,
      saturationCount: 0,
      stability,
      notes: stability === "unavailable" ? ["No usable values."] : [],
    };
  });

  const inferredPartialDates =
    params.partialDates ??
    (scoreSummaries.some((summary) => summary.stability === "unavailable" || summary.missingCount > 0) ? 12 : 0);

  return {
    generatedAt: "2026-06-20T00:00:00.000Z",
    engineVersion: "historical-replay-debug",
    params: {
      days: 30,
      step: 5,
      startDate: params.startDate,
      endDate: params.endDate,
    },
    summary: {
      replayDates: 12,
      successfulDates: 12 - inferredPartialDates,
      partialDates: inferredPartialDates,
      failedDates: 0,
      stableScores: scoreSummaries.filter((summary) => summary.stability === "stable").length,
      watchScores: scoreSummaries.filter((summary) => summary.stability === "watch").length,
      unstableScores: scoreSummaries.filter((summary) => summary.stability === "unstable").length,
      unavailableScores: scoreSummaries.filter((summary) => summary.stability === "unavailable").length,
      scoreSummaries,
    },
    rows: [],
    globalNotes: [],
  };
}

describe("stressWindowReplayService", () => {
  test("predefined stress windows exist", () => {
    expect(STRESS_WINDOWS.map((window) => window.id)).toEqual([
      "covid_liquidity_shock_2020",
      "inflation_fed_hiking_2022",
      "banking_stress_2023",
      "recent_high_rate_risk_on",
    ]);
  });

  test("dynamic recent window resolves start and end dates", () => {
    const { windows } = resolveStressWindows({
      requestedWindow: "recent_high_rate_risk_on",
      today: new Date("2026-06-20T12:00:00Z"),
    });

    expect(windows).toHaveLength(1);
    expect(windows[0].id).toBe("recent_high_rate_risk_on");
    expect(windows[0].endDate).toBe("2026-06-20");
    expect(windows[0].startDate).toBe("2025-12-22");
  });

  test("invalid step clamps safely", () => {
    expect(clampStressWindowStep(0)).toBe(1);
    expect(clampStressWindowStep(99)).toBe(10);
    expect(clampStressWindowStep(5.8)).toBe(5);
  });

  test("invalid window returns all windows with a global note", async () => {
    const result = await buildStressWindowReplayResult({
      observationsBySymbol: {},
      requestedWindow: "bad_window",
      step: 5,
      today: new Date("2026-06-20T00:00:00Z"),
      runReplay: ({ startDate, endDate }) => replayResult({ startDate, endDate }),
    });

    expect(result.windows).toHaveLength(STRESS_WINDOWS.length);
    expect(result.globalNotes.join(" ")).toContain("Invalid stress window");
  });

  test("single-window filter works", async () => {
    const result = await buildStressWindowReplayResult({
      observationsBySymbol: {},
      requestedWindow: "inflation_fed_hiking_2022",
      step: 5,
      today: new Date("2026-06-20T00:00:00Z"),
      runReplay: ({ startDate, endDate }) => replayResult({ startDate, endDate }),
    });

    expect(result.windows).toHaveLength(1);
    expect(result.windows[0].id).toBe("inflation_fed_hiking_2022");
  });

  test("unstable focus score leads to watch or concern", async () => {
    const result = await buildStressWindowReplayResult({
      observationsBySymbol: {},
      requestedWindow: "inflation_fed_hiking_2022",
      step: 5,
      today: new Date("2026-06-20T00:00:00Z"),
      runReplay: ({ startDate, endDate }) =>
        replayResult({
          startDate,
          endDate,
          stability: {
            inflation_score: "unstable",
            dollar_score: "unstable",
          },
        }),
    });

    expect(["watch", "concern"]).toContain(result.windows[0].verdict);
    expect(result.windows[0].scoreSummaries.find((summary) => summary.scoreKey === "inflation_score")?.interpretation).toBe("warning");
  });

  test("unavailable focus score leads to unavailable or watch", async () => {
    const result = await buildStressWindowReplayResult({
      observationsBySymbol: {},
      requestedWindow: "banking_stress_2023",
      step: 5,
      today: new Date("2026-06-20T00:00:00Z"),
      runReplay: ({ startDate, endDate }) =>
        replayResult({
          startDate,
          endDate,
          stability: {
            credit_score: "unavailable",
            liquidity_score: "unavailable",
            risk_appetite_score: "unavailable",
          },
        }),
    });

    expect(["unavailable", "watch", "concern"]).toContain(result.windows[0].verdict);
  });

  test("stable and watch focus scores lead to pass_like", async () => {
    const result = await buildStressWindowReplayResult({
      observationsBySymbol: {},
      requestedWindow: "covid_liquidity_shock_2020",
      step: 5,
      today: new Date("2026-06-20T00:00:00Z"),
      runReplay: ({ startDate, endDate }) =>
        replayResult({
          startDate,
          endDate,
          stability: {
            liquidity_score: "watch",
            credit_score: "stable",
            risk_appetite_score: "watch",
            dollar_score: "stable",
          },
        }),
    });

    expect(result.windows[0].verdict).toBe("pass_like");
  });

  test("one window failure does not crash whole result", async () => {
    const result = await buildStressWindowReplayResult({
      observationsBySymbol: {},
      requestedWindow: "all",
      step: 5,
      today: new Date("2026-06-20T00:00:00Z"),
      runReplay: ({ windowId, startDate, endDate }) => {
        if (windowId === "banking_stress_2023") throw new Error("boom");
        return replayResult({ startDate, endDate });
      },
    });

    expect(result.windows).toHaveLength(STRESS_WINDOWS.length);
    expect(result.summary.failedWindows).toBe(1);
    expect(result.globalNotes.join(" ")).toContain("banking_stress_2023");
  });

  test("output includes all 8 score summaries when replay is available", async () => {
    const observationsBySymbol: ObservationSeriesMap = {};
    const result = await buildStressWindowReplayResult({
      observationsBySymbol,
      requestedWindow: "covid_liquidity_shock_2020",
      step: 5,
      today: new Date("2026-06-20T00:00:00Z"),
      runReplay: ({ startDate, endDate }) => replayResult({ startDate, endDate }),
    });

    expect(result.windows[0].scoreSummaries.map((summary) => summary.scoreKey)).toEqual(allScoreKeys);
  });

  test("china_score unavailable only does not affect promotion readiness", async () => {
    const result = await buildStressWindowReplayResult({
      observationsBySymbol: {},
      requestedWindow: "covid_liquidity_shock_2020",
      step: 5,
      today: new Date("2026-06-20T00:00:00Z"),
      runReplay: ({ startDate, endDate }) =>
        replayResult({
          startDate,
          endDate,
          stability: { china_score: "unavailable" },
        }),
    });

    expect(result.windows[0].partialReasons.expectedUnavailableScores).toEqual(["china_score"]);
    expect(result.windows[0].partialReasons.focusUnavailableScores).toEqual([]);
    expect(result.windows[0].partialReasons.affectsPromotionReadiness).toBe(false);
    expect(result.windows[0].partialReasons.summary).toContain("china_score");
  });

  test("non-focus unavailable only does not affect promotion readiness", async () => {
    const result = await buildStressWindowReplayResult({
      observationsBySymbol: {},
      requestedWindow: "covid_liquidity_shock_2020",
      step: 5,
      today: new Date("2026-06-20T00:00:00Z"),
      runReplay: ({ startDate, endDate }) =>
        replayResult({
          startDate,
          endDate,
          stability: { inflation_score: "unavailable" },
        }),
    });

    expect(result.windows[0].partialReasons.nonFocusUnavailableScores).toEqual(["inflation_score"]);
    expect(result.windows[0].partialReasons.affectsPromotionReadiness).toBe(false);
    expect(result.windows[0].partialReasons.summary).toContain("non-focus");
  });

  test("focus unavailable affects promotion readiness", async () => {
    const result = await buildStressWindowReplayResult({
      observationsBySymbol: {},
      requestedWindow: "covid_liquidity_shock_2020",
      step: 5,
      today: new Date("2026-06-20T00:00:00Z"),
      runReplay: ({ startDate, endDate }) =>
        replayResult({
          startDate,
          endDate,
          stability: { liquidity_score: "unavailable" },
        }),
    });

    expect(result.windows[0].partialReasons.focusUnavailableScores).toEqual(["liquidity_score"]);
    expect(result.windows[0].partialReasons.affectsPromotionReadiness).toBe(true);
    expect(result.windows[0].partialReasons.summary).toContain("focus scores are unavailable");
  });

  test("focus unstable affects promotion readiness", async () => {
    const result = await buildStressWindowReplayResult({
      observationsBySymbol: {},
      requestedWindow: "banking_stress_2023",
      step: 5,
      today: new Date("2026-06-20T00:00:00Z"),
      runReplay: ({ startDate, endDate }) =>
        replayResult({
          startDate,
          endDate,
          stability: { credit_score: "unstable" },
        }),
    });

    expect(result.windows[0].partialReasons.focusUnstableScores).toEqual(["credit_score"]);
    expect(result.windows[0].partialReasons.affectsPromotionReadiness).toBe(true);
    expect(result.windows[0].partialReasons.summary).toContain("Focus score instability");
  });

  test("multiple focus unavailable or unstable leans concern", async () => {
    const result = await buildStressWindowReplayResult({
      observationsBySymbol: {},
      requestedWindow: "banking_stress_2023",
      step: 5,
      today: new Date("2026-06-20T00:00:00Z"),
      runReplay: ({ startDate, endDate }) =>
        replayResult({
          startDate,
          endDate,
          stability: {
            credit_score: "unavailable",
            liquidity_score: "unstable",
          },
        }),
    });

    expect(result.windows[0].partialReasons.affectsPromotionReadiness).toBe(true);
    expect(result.windows[0].verdict).toBe("concern");
  });

  test("partialReasons summary is populated", async () => {
    const result = await buildStressWindowReplayResult({
      observationsBySymbol: {},
      requestedWindow: "inflation_fed_hiking_2022",
      step: 5,
      today: new Date("2026-06-20T00:00:00Z"),
      runReplay: ({ startDate, endDate }) => replayResult({ startDate, endDate }),
    });

    expect(result.windows[0].partialReasons.summary.length).toBeGreaterThan(0);
  });

  test("fully ok window does not affect promotion readiness", async () => {
    const result = await buildStressWindowReplayResult({
      observationsBySymbol: {},
      requestedWindow: "inflation_fed_hiking_2022",
      step: 5,
      today: new Date("2026-06-20T00:00:00Z"),
      runReplay: ({ startDate, endDate }) => replayResult({ startDate, endDate, partialDates: 0 }),
    });

    expect(result.windows[0].status).toBe("ok");
    expect(result.windows[0].partialReasons.affectsPromotionReadiness).toBe(false);
    expect(result.windows[0].partialReasons.summary).toBe("All focus scores are available for this stress window.");
  });

  test("expected unavailable scores includes china_score", async () => {
    const result = await buildStressWindowReplayResult({
      observationsBySymbol: {},
      requestedWindow: "recent_high_rate_risk_on",
      step: 5,
      today: new Date("2026-06-20T00:00:00Z"),
      runReplay: ({ startDate, endDate }) =>
        replayResult({
          startDate,
          endDate,
          stability: { china_score: "unavailable" },
        }),
    });

    expect(result.windows[0].partialReasons.expectedUnavailableScores).toContain("china_score");
  });
});
