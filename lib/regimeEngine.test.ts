import { describe, expect, test } from "vitest";
import type { IndicatorStats } from "@/lib/calculateIndicators";
import { calculateMacroRegime } from "@/lib/regimeEngine";

function stat(
  symbol: string,
  values: {
    latestValue?: number | null;
    change30d?: number | null;
    change90d?: number | null;
    previousValue?: number | null;
  },
): IndicatorStats {
  const latestValue = values.latestValue ?? 100;
  const change30d = values.change30d ?? null;
  const change90d = values.change90d ?? null;
  const previousValue = values.previousValue ?? (change30d === null ? null : latestValue - change30d);

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
    previousValue,
    change1d: null,
    change7d: null,
    change30d,
    change90d,
    zScore: null,
    percentile: null,
    trend: "mixed",
    macroMeaning: "",
  };
}

describe("calculateMacroRegime", () => {
  test("detects reflation trade when inflation is high and 10Y yield rises", () => {
    const result = calculateMacroRegime([
      stat("CPIAUCSL", { change90d: 1 }),
      stat("CPILFESL", { change90d: 1 }),
      stat("PCEPI", { change90d: 1 }),
      stat("PCEPILFE", { change90d: 1 }),
      stat("DCOILWTICO", { change30d: 3 }),
      stat("HG=F", { change30d: 0.3 }),
      stat("DGS10", { change30d: 0.3 }),
    ]);

    expect(result.inflationScore).toBe(5.5);
    expect(result.finalRegime).toBe("再通脹交易");
  });

  test("detects recession cut trade when growth weakens and 2Y yield falls", () => {
    const result = calculateMacroRegime([
      stat("UNRATE", { change90d: 0.3 }),
      stat("ICSA", { change30d: 25_000 }),
      stat("PAYEMS", { change90d: -120 }),
      stat("JTSJOL", { change90d: -200 }),
      stat("DGS2", { change30d: -0.4 }),
    ]);

    expect(result.growthScore).toBe(-4);
    expect(result.finalRegime).toBe("衰退降息交易");
  });

  test("detects safe haven mode when VIX and credit spreads rise", () => {
    const result = calculateMacroRegime([
      stat("VIXCLS", { change30d: 6 }),
      stat("BAMLH0A0HYM2", { latestValue: 5.4, change30d: 0.8 }),
      stat("DX-Y.NYB", { change30d: 1.2 }),
    ]);

    expect(result.riskAppetiteScore).toBe(-2);
    expect(result.creditScore).toBe(-3);
    expect(result.finalRegime).toBe("避險模式");
  });

  test("uses Yahoo DXY and FX proxies in dollar score", () => {
    const result = calculateMacroRegime([
      stat("DX-Y.NYB", { change30d: 2 }),
      stat("JPY=X", { change30d: 1 }),
      stat("CNH=X", { change30d: 0.2 }),
    ]);

    expect(result.dollarScore).toBe(3);
    expect(result.summary).toContain("亞洲資金壓力增加");
  });

  test("uses Yahoo equity indexes in risk appetite score", () => {
    const result = calculateMacroRegime([
      stat("^GSPC", { change30d: 100 }),
      stat("^NDX", { change30d: 200 }),
      stat("VIXCLS", { change30d: -4 }),
      stat("BAMLH0A0HYM2", { change30d: -0.5, latestValue: 3.8 }),
      stat("DGS2", { change30d: -0.2 }),
    ]);

    expect(result.riskAppetiteScore).toBe(4);
    expect(result.finalRegime).toBe("風險偏好模式");
  });

  test("detects high-rate risk appetite environment", () => {
    const result = calculateMacroRegime([
      stat("^GSPC", { change30d: 100 }),
      stat("^NDX", { change30d: 200 }),
      stat("VIXCLS", { change30d: -4 }),
      stat("BAMLH0A0HYM2", { change30d: -0.5, latestValue: 3.6 }),
      stat("UNRATE", { change90d: -0.2 }),
      stat("PAYEMS", { change90d: 100 }),
      stat("DGS2", { change30d: 0.3 }),
      stat("WALCL", { change30d: -100 }),
      stat("DX-Y.NYB", { change30d: 2 }),
      stat("CPIAUCSL", { change90d: 1 }),
      stat("CPILFESL", { change90d: 1 }),
      stat("PCEPI", { change90d: 1 }),
    ]);

    expect(result.riskAppetiteScore).toBe(4);
    expect(result.creditScore).toBe(3);
    expect(result.growthScore).toBe(2);
    expect(result.liquidityScore).toBeLessThan(0);
    expect(result.dollarScore).toBeGreaterThanOrEqual(1);
    expect(result.finalRegime).toBe("高利率風險偏好環境");
    expect(result.summary).toContain("高利率下的風險偏好");
    expect(result.summary).toContain("通脹壓力仍然偏高");
  });

  test("adds commodity and gold silver ratio notes", () => {
    const result = calculateMacroRegime([
      stat("GC=F", { latestValue: 2800, previousValue: 2500, change30d: 300 }),
      stat("SI=F", { latestValue: 30, previousValue: 25, change30d: 5 }),
      stat("HG=F", { change30d: 0.4 }),
      stat("DCOILWTICO", { change30d: 5 }),
    ]);

    expect(result.commodityScore).toBe(4);
    expect(result.summary).toContain("白銀相對弱");
    expect(result.summary).toContain("白銀相對黃金轉強");
    expect(result.summary).toContain("工業/能源再通脹確認");
  });

  test("detects risk-on mode when risk appetite and liquidity improve", () => {
    const result = calculateMacroRegime([
      stat("VIXCLS", { change30d: -5 }),
      stat("BAMLH0A0HYM2", { latestValue: 3.5, change30d: -0.7 }),
      stat("DGS10", { change30d: -0.2 }),
      stat("DGS2", { change30d: -0.3 }),
      stat("WALCL", { change30d: 200 }),
      stat("RRPONTSYD", { change30d: -150 }),
    ]);

    expect(result.riskAppetiteScore).toBe(2);
    expect(result.liquidityScore).toBe(3.5);
    expect(result.finalRegime).toBe("風險偏好模式");
  });

  test("returns mixed regime when data is insufficient", () => {
    const result = calculateMacroRegime([]);

    expect(result.finalRegime).toBe("混合震盪模式");
    expect(result.liquidityScore).toBe(0);
    expect(result.summary).toContain("沒有形成單一清晰主線");
  });
});
