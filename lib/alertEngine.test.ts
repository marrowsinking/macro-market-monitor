import { describe, expect, test } from "vitest";
import type { IndicatorStats } from "@/lib/calculateIndicators";
import { evaluateMacroAlerts } from "@/lib/alertEngine";

function stat(symbol: string, latestValue: number, change30d: number, previousValue?: number): IndicatorStats {
  return {
    indicator: {
      id: 1,
      name: symbol,
      symbol,
      category: "test",
      source: "test",
      fredSeriesId: null,
      frequency: "daily",
      description: "",
      macroLogic: "",
      createdAt: new Date(),
      updatedAt: new Date(),
      observations: [],
    },
    latestValue,
    latestDate: new Date(),
    previousValue: previousValue ?? latestValue - change30d,
    change1d: change30d,
    change7d: change30d,
    change30d,
    change90d: change30d,
    zScore: null,
    percentile: null,
    trend: "mixed",
    macroMeaning: "",
  };
}

describe("evaluateMacroAlerts", () => {
  test("triggers macro alerts from latest indicator stats", () => {
    const alerts = evaluateMacroAlerts([
      stat("DX-Y.NYB", 104, 4),
      stat("VIXCLS", 28, 3),
      stat("BAMLH0A0HYM2", 5.4, 0.3),
      stat("CNH=X", 7.4, 0.1),
      stat("DGS10", 5.1, 0.2),
      stat("T10Y2Y", 0.1, 0.2, -0.1),
      stat("GC=F", 2800, 100),
      stat("SI=F", 30, -1),
      stat("DGS2", 4.1, -0.6),
      stat("DCOILWTICO", 88, 10),
    ]);

    expect(alerts.map((alert) => alert.key)).toEqual([
      "dxy-30d-up-3pct",
      "vix-above-25",
      "hy-spread-above-5",
      "usdcnh-above-735",
      "dgs10-above-5",
      "t10y2y-turns-positive",
      "gold-silver-ratio-above-90",
      "dgs2-down-50bp",
      "wti-30d-up-10pct",
    ]);
  });
});
