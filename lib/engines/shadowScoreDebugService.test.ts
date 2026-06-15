import { describe, expect, test } from "vitest";
import {
  buildObservationSeriesMap,
  collectRequiredShadowSymbols,
  createShadowScoreDebugPayload,
  createShadowScoreSummary,
} from "@/lib/engines/shadowScoreDebugService";
import type { ObservationSeriesMap } from "@/lib/engines/shadowScoreEngine";

function series(values: number[]): ObservationSeriesMap {
  return {
    CPIAUCSL: values.map((value, index) => ({ date: `2020-${String(index + 1).padStart(2, "0")}-01`, value })),
  };
}

describe("shadowScoreDebugService", () => {
  test("collectRequiredShadowSymbols returns configured scored symbols without placeholders", () => {
    const symbols = collectRequiredShadowSymbols();

    expect(symbols.length).toBeGreaterThan(0);
    expect(symbols).toEqual([...symbols].sort());
    expect(new Set(symbols).size).toBe(symbols.length);
    expect(symbols).toEqual(expect.arrayContaining(["CPIAUCSL", "VIXCLS", "DX-Y.NYB", "CNY=X", "BAMLH0A0HYM2", "DCOILWTICO"]));
    expect(symbols).not.toContain("CNH=X");
    expect(symbols).not.toContain("CHINA_M2");
  });

  test("buildObservationSeriesMap groups rows by symbol, coerces string values, and sorts by date", () => {
    const map = buildObservationSeriesMap([
      { symbol: "DGS10", date: "2024-01-03", value: "4.2" },
      { symbol: "DGS10", date: "2024-01-01", value: 4 },
      { symbol: "VIXCLS", date: new Date("2024-01-02T00:00:00Z"), value: "15.5" },
    ]);

    expect(map.DGS10).toEqual([
      { date: "2024-01-01", value: 4 },
      { date: "2024-01-03", value: 4.2 },
    ]);
    expect(map.VIXCLS).toEqual([{ date: "2024-01-02", value: 15.5 }]);
  });

  test("buildObservationSeriesMap drops invalid numeric values before normalization", () => {
    const map = buildObservationSeriesMap([
      { symbol: "DGS10", date: "2024-01-01", value: "." },
      { symbol: "DGS10", date: "2024-01-02", value: null },
      { symbol: "DGS10", date: "2024-01-03", value: "4.1" },
    ]);

    expect(map.DGS10).toEqual([{ date: "2024-01-03", value: 4.1 }]);
  });

  test("createShadowScoreDebugPayload returns all scores and coverage details", () => {
    const payload = createShadowScoreDebugPayload({
      observationsBySymbol: series([100, 101, 102, 103]),
      requestedSymbols: ["CPIAUCSL", "VIXCLS"],
      availableSymbols: ["CPIAUCSL"],
      generatedAt: new Date("2026-01-02T03:04:00Z"),
    });

    expect(payload.generatedAt).toBe("2026-01-02T03:04:00.000Z");
    expect(payload.engineVersion).toBe("shadow-score-v2-debug");
    expect(Object.keys(payload.scores)).toHaveLength(8);
    expect(payload.coverage).toMatchObject({
      requestedSymbolCount: 2,
      availableSymbolCount: 1,
      missingSymbolCount: 1,
      missingSymbols: ["VIXCLS"],
    });
    expect(payload.warnings).toContain("Some configured symbols have no observations in database.");
  });

  test("createShadowScoreDebugPayload warns when some scores have no usable data", () => {
    const payload = createShadowScoreDebugPayload({
      observationsBySymbol: {},
      requestedSymbols: ["CPIAUCSL"],
      availableSymbols: [],
      generatedAt: new Date("2026-01-02T03:04:00Z"),
    });

    expect(payload.warnings).toContain("Some shadow scores have no usable data.");
    expect(payload.warnings).toContain("china_score is placeholder and not included in scored regime logic.");
  });

  test("createShadowScoreSummary returns compact score and group summaries", () => {
    const payload = createShadowScoreDebugPayload({
      observationsBySymbol: series([100, 101, 102, 103]),
      requestedSymbols: ["CPIAUCSL"],
      availableSymbols: ["CPIAUCSL"],
      generatedAt: new Date("2026-01-02T03:04:00Z"),
    });
    const summary = createShadowScoreSummary(payload);

    expect(summary.scores.inflation_score.scoreKey).toBe("inflation_score");
    expect(summary.scores.inflation_score.groups[0]).toEqual(
      expect.objectContaining({
        groupKey: expect.any(String),
        contribution: expect.any(Number),
        status: expect.any(String),
      }),
    );
    expect(summary.scores.inflation_score.groups[0]).not.toHaveProperty("factors");
  });
});
