import { describe, expect, test } from "vitest";
import type { IndicatorStats } from "@/lib/calculateIndicators";
import { getScoreBreakdowns } from "@/lib/scores/scoreBreakdown";

function stat(symbol: string, values: Array<[string, number]>, source = "TEST"): IndicatorStats {
  const observations = values.map(([date, value], index) => ({
    id: index + 1,
    indicatorId: 1,
    date: new Date(`${date}T00:00:00.000Z`),
    value,
    createdAt: new Date(),
  }));
  const latest = observations[observations.length - 1] ?? null;
  const previous = observations[observations.length - 2] ?? null;
  const latestValue = latest?.value ?? null;

  return {
    indicator: {
      id: 1,
      name: symbol,
      symbol,
      category: "test",
      source,
      fredSeriesId: null,
      frequency: "daily",
      description: "",
      macroLogic: "",
      createdAt: new Date(),
      updatedAt: new Date(),
      observations,
    },
    latestValue,
    latestDate: latest?.date ?? null,
    previousValue: previous?.value ?? null,
    change1d: latest && previous ? latest.value - previous.value : null,
    change7d: null,
    change30d: latest ? latest.value - observations[0].value : null,
    change90d: latest ? latest.value - observations[0].value : null,
    zScore: null,
    percentile: null,
    trend: "mixed",
    macroMeaning: "",
  };
}

const baseScores = {
  liquidityScore: 0,
  inflationScore: 0,
  growthScore: 0,
  riskAppetiteScore: 0,
  dollarScore: 0,
  creditScore: 0,
  commodityScore: 0,
  chinaScore: 0,
};

function factor(output: ReturnType<typeof getScoreBreakdowns>, scoreKey: string, symbol: string) {
  return output.find((item) => item.key === scoreKey)?.factors.find((item) => item.symbol === symbol);
}

describe("getScoreBreakdowns", () => {
  test("calculates latestValue", () => {
    const output = getScoreBreakdowns({
      stats: [stat("VIXCLS", [["2026-01-01", 20], ["2026-01-28", 16], ["2026-01-31", 15]])],
      scores: baseScores,
    });

    expect(factor(output, "risk_appetite_score", "VIXCLS")?.latestValue).toBe(15);
  });

  test("calculates change3d", () => {
    const output = getScoreBreakdowns({
      stats: [stat("VIXCLS", [["2026-01-01", 20], ["2026-01-28", 16], ["2026-01-31", 15]])],
      scores: baseScores,
    });

    expect(factor(output, "risk_appetite_score", "VIXCLS")?.change3d).toBe(-1);
  });

  test("calculates change30d", () => {
    const output = getScoreBreakdowns({
      stats: [stat("VIXCLS", [["2026-01-01", 20], ["2026-01-28", 16], ["2026-01-31", 15]])],
      scores: baseScores,
    });

    expect(factor(output, "risk_appetite_score", "VIXCLS")?.change30d).toBe(-5);
  });

  test("gives volatility group positive contribution when VIX 30d change is negative", () => {
    const output = getScoreBreakdowns({
      stats: [stat("VIXCLS", [["2026-01-01", 20], ["2026-01-31", 15]])],
      scores: baseScores,
    });

    expect(factor(output, "risk_appetite_score", "volatilityGroup")?.contribution).toBe(1.5);
    expect(factor(output, "risk_appetite_score", "VIXCLS")?.contribution).toBeNull();
  });

  test("keeps DGS10 out of risk appetite factor list after double-count cleanup", () => {
    const output = getScoreBreakdowns({
      stats: [stat("DGS10", [["2026-01-01", 4], ["2026-01-31", 5]])],
      scores: baseScores,
    });

    expect(factor(output, "risk_appetite_score", "DGS10")).toBeUndefined();
  });

  test("gives DXY +2 contribution when 30d change is positive", () => {
    const output = getScoreBreakdowns({
      stats: [stat("DX-Y.NYB", [["2026-01-01", 100], ["2026-01-31", 103]], "YAHOO")],
      scores: baseScores,
    });

    expect(factor(output, "dollar_score", "DX-Y.NYB")?.contribution).toBe(2);
  });

  test("does not use inactive indicator stats", () => {
    const output = getScoreBreakdowns({
      stats: [stat("DX-Y.NYB", [["2026-01-01", 100], ["2026-01-31", 103]], "PLACEHOLDER")],
      scores: baseScores,
    });

    expect(factor(output, "dollar_score", "DX-Y.NYB")?.contribution).toBeNull();
  });

  test("does not throw when data is insufficient", () => {
    const output = getScoreBreakdowns({
      stats: [],
      scores: baseScores,
    });

    expect(factor(output, "risk_appetite_score", "VIXCLS")?.latestValue).toBeNull();
    expect(factor(output, "risk_appetite_score", "VIXCLS")?.contribution).toBeNull();
  });

  test("shows capped core inflation group contribution", () => {
    const output = getScoreBreakdowns({
      stats: [
        stat("CPILFESL", [["2026-01-01", 100], ["2026-01-31", 101]]),
        stat("PCEPILFE", [["2026-01-01", 100], ["2026-01-31", 101]]),
      ],
      scores: baseScores,
    });

    expect(factor(output, "inflation_score", "coreInflationGroup")?.contribution).toBe(1.5);
    expect(factor(output, "inflation_score", "CPILFESL")?.contribution).toBeNull();
    expect(factor(output, "inflation_score", "PCEPILFE")?.contribution).toBeNull();
  });

  test("caps equity confirmation downside when dollar pressure is high", () => {
    const output = getScoreBreakdowns({
      stats: [
        stat("DX-Y.NYB", [["2026-01-01", 100], ["2026-01-31", 103]], "YAHOO"),
        stat("DGS2", [["2026-01-01", 4], ["2026-01-31", 4.3]], "FRED"),
        stat("^GSPC", [["2026-01-01", 5000], ["2026-01-31", 4800]], "YAHOO"),
        stat("^NDX", [["2026-01-01", 18000], ["2026-01-31", 17000]], "YAHOO"),
      ],
      scores: baseScores,
    });

    expect(factor(output, "risk_appetite_score", "equityConfirmationGroup")?.contribution).toBe(-1);
    expect(factor(output, "risk_appetite_score", "equityConfirmationGroup")?.interpretation).toContain("封頂");
  });

  test("uses copper and oil as the direct commodity cycle group", () => {
    const output = getScoreBreakdowns({
      stats: [
        stat("HG=F", [["2026-01-01", 4], ["2026-01-31", 4.4]], "YAHOO"),
        stat("DCOILWTICO", [["2026-01-01", 70], ["2026-01-31", 76]], "FRED"),
      ],
      scores: baseScores,
    });

    expect(factor(output, "commodity_score", "growthLedCommodityGroup")?.contribution).toBe(2);
    expect(factor(output, "commodity_score", "GC=F")?.contribution).toBeNull();
  });

  test("shows gold silver ratio as defensive signal without score contribution", () => {
    const output = getScoreBreakdowns({
      stats: [
        stat("GC=F", [["2026-01-01", 2500], ["2026-01-31", 3000]], "YAHOO"),
        stat("SI=F", [["2026-01-01", 30], ["2026-01-31", 30]], "YAHOO"),
      ],
      scores: baseScores,
    });

    expect(factor(output, "commodity_score", "Gold/Silver Ratio")?.contribution).toBeNull();
    expect(factor(output, "commodity_score", "Gold/Silver Ratio")?.interpretation).toContain("不直接推高商品週期分數");
  });
});
