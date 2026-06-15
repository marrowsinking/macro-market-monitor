import { describe, expect, test } from "vitest";
import { getAllFactorsForScore, getMacroScoreConfig, macroScoreKeys } from "@/lib/config/macroEngineConfig";
import type { MacroFactorConfig, MacroFactorGroupConfig, MacroScoreKey } from "@/lib/config/macroEngineConfig.types";
import type { RawObservationPoint } from "@/lib/engines/normalizationEngine";
import {
  calculateAllShadowScores,
  calculateShadowFactorContribution,
  calculateShadowGroupContribution,
  calculateShadowScore,
  mapNormalizedStatusToContributionStatus,
} from "@/lib/engines/shadowScoreEngine";

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function makeDailySeries(startDate: string, values: number[]): RawObservationPoint[] {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  return values.map((value, index) => ({ date: addDays(start, index), value }));
}

function risingSeries(length: number, start = 100, step = 1): RawObservationPoint[] {
  return makeDailySeries("2025-01-01", Array.from({ length }, (_, index) => start + index * step + (index % 3) * 0.1));
}

function fallingSeries(length: number, start = 100, step = 1): RawObservationPoint[] {
  return makeDailySeries("2025-01-01", Array.from({ length }, (_, index) => start - index * step + (index % 3) * 0.1));
}

function factor(scoreKey: MacroScoreKey, symbol: string): MacroFactorConfig {
  const found = getAllFactorsForScore(scoreKey).find((item) => item.symbol === symbol);
  if (!found) throw new Error(`Missing factor ${symbol} in ${scoreKey}`);
  return found;
}

function testFactor(symbol: string, overrides: Partial<MacroFactorConfig> = {}): MacroFactorConfig {
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
    minObservations: 10,
    normalizationNote: "test",
    description: "test",
    easyModeExplanation: "test",
    ...overrides,
  };
}

describe("shadowScoreEngine", () => {
  test("maps normalization status to contribution status", () => {
    expect(mapNormalizedStatusToContributionStatus("ok")).toBe("ok");
    expect(mapNormalizedStatusToContributionStatus("insufficient_data")).toBe("insufficient_data");
    expect(mapNormalizedStatusToContributionStatus("invalid_data")).toBe("invalid_data");
    expect(mapNormalizedStatusToContributionStatus("not_scored")).toBe("not_scored");
    expect(mapNormalizedStatusToContributionStatus("unsupported_transform")).toBe("unsupported_transform");
    expect(mapNormalizedStatusToContributionStatus("other")).toBe("invalid_data");
  });

  test("positive normalized signal increases factor contribution when polarity increases score", () => {
    const result = calculateShadowFactorContribution({
      scoreKey: "inflation_score",
      groupKey: "headline_inflation",
      factor: testFactor("CPIAUCSL", { weight: 0.5 }),
      observations: risingSeries(50),
    });

    expect(result.status).toBe("ok");
    expect(result.normalizedSignal).toBeGreaterThan(0);
    expect(result.contribution).toBeGreaterThan(0);
    expect(result.contribution).toBeCloseTo((result.normalizedSignal ?? 0) * 0.5, 6);
  });

  test("positive normalized signal decreases factor contribution when polarity decreases score", () => {
    const result = calculateShadowFactorContribution({
      scoreKey: "risk_appetite_score",
      groupKey: "volatility_stress",
      factor: testFactor("VIXCLS", { scorePolarity: "higher_decreases_score" }),
      observations: risingSeries(50),
    });

    expect(result.status).toBe("ok");
    expect(result.normalizedSignal).toBeGreaterThan(0);
    expect(result.contribution).toBeLessThan(0);
  });

  test("context dependent and not scored factors contribute zero", () => {
    const gold = calculateShadowFactorContribution({
      scoreKey: "commodity_score",
      groupKey: "defensive_precious_metals",
      factor: factor("commodity_score", "GC=F"),
      observations: risingSeries(60),
    });
    const china = calculateShadowFactorContribution({
      scoreKey: "china_score",
      groupKey: "china_placeholder",
      factor: factor("china_score", "CHINA_M2"),
      observations: risingSeries(60),
    });

    expect(gold.status).toBe("context_dependent");
    expect(gold.contribution).toBe(0);
    expect(china.status).toBe("not_scored");
    expect(china.contribution).toBe(0);
  });

  test("missing observations contribute zero and preserve metadata", () => {
    const result = calculateShadowFactorContribution({
      scoreKey: "risk_appetite_score",
      groupKey: "volatility_stress",
      factor: factor("risk_appetite_score", "VIXCLS"),
      observations: undefined,
    });

    expect(result.status).toBe("missing_observations");
    expect(result.symbol).toBe("VIXCLS");
    expect(result.contribution).toBe(0);
  });

  test("group raw contribution sums factor contributions and applies cap", () => {
    const group: MacroFactorGroupConfig = {
      key: "test_group",
      zhName: "測試",
      enName: "Test",
      description: "test",
      minContribution: -0.5,
      maxContribution: 0.5,
      factors: [
        testFactor("A", { weight: 1 }),
        testFactor("B", { weight: 1 }),
        testFactor("C", { scorePolarity: "context_dependent" }),
      ],
    };
    const result = calculateShadowGroupContribution({
      scoreKey: "inflation_score",
      group,
      observationsBySymbol: {
        A: risingSeries(50),
        B: risingSeries(50, 200, 2),
      },
    });

    const factorSum = result.factors.reduce((sum, item) => sum + item.contribution, 0);
    expect(result.rawContribution).toBeCloseTo(factorSum, 6);
    expect(result.contribution).toBe(0.5);
    expect(result.capApplied).toBe(true);
    expect(result.factors).toHaveLength(3);
    expect(result.factors.find((item) => item.symbol === "C")?.status).toBe("context_dependent");
  });

  test("inflation and risk appetite score can calculate shadow score results", () => {
    const inflation = calculateShadowScore({
      scoreConfig: getMacroScoreConfig("inflation_score"),
      observationsBySymbol: {
        CPIAUCSL: risingSeries(420),
        PCEPI: risingSeries(420, 100, 0.8),
        CPILFESL: risingSeries(420, 100, 0.6),
        PCEPILFE: risingSeries(420, 100, 0.5),
        DCOILWTICO: risingSeries(80),
        DGS10: risingSeries(80, 4, 0.02),
      },
    });
    const risk = calculateShadowScore({
      scoreConfig: getMacroScoreConfig("risk_appetite_score"),
      observationsBySymbol: {
        VIXCLS: fallingSeries(80, 30, 0.1),
        BAMLH0A0HYM2: fallingSeries(80, 5, 0.01),
        "^GSPC": risingSeries(80, 5000, 5),
        "^NDX": risingSeries(80, 18000, 10),
        DGS10: fallingSeries(80, 5, 0.01),
      },
    });

    expect(inflation.scoreKey).toBe("inflation_score");
    expect(inflation.status).toBe("ok");
    expect(inflation.value).not.toBe(0);
    expect(risk.scoreKey).toBe("risk_appetite_score");
    expect(risk.status).toBe("ok");
    expect(risk.value).not.toBe(0);
  });

  test("china score is not scored and empty non-placeholder score is no_data", () => {
    const china = calculateShadowScore({
      scoreConfig: getMacroScoreConfig("china_score"),
      observationsBySymbol: {},
    });
    const liquidity = calculateShadowScore({
      scoreConfig: getMacroScoreConfig("liquidity_score"),
      observationsBySymbol: {},
    });

    expect(china.status).toBe("not_scored");
    expect(china.value).toBe(0);
    expect(liquidity.status).toBe("no_data");
  });

  test("score is partial when only some scored factors have observations", () => {
    const result = calculateShadowScore({
      scoreConfig: getMacroScoreConfig("risk_appetite_score"),
      observationsBySymbol: {
        VIXCLS: risingSeries(80),
      },
    });

    expect(result.status).toBe("partial");
    expect(result.groups.flatMap((group) => group.factors).some((item) => item.status === "ok")).toBe(true);
    expect(result.groups.flatMap((group) => group.factors).some((item) => item.status === "missing_observations")).toBe(true);
  });

  test("calculateAllShadowScores returns all macro score keys", () => {
    const result = calculateAllShadowScores({ observationsBySymbol: {} });

    expect(Object.keys(result).sort()).toEqual([...macroScoreKeys].sort());
    expect(result.liquidity_score.scoreKey).toBe("liquidity_score");
    expect(result.inflation_score.scoreKey).toBe("inflation_score");
    expect(result.growth_score.scoreKey).toBe("growth_score");
    expect(result.risk_appetite_score.scoreKey).toBe("risk_appetite_score");
    expect(result.dollar_score.scoreKey).toBe("dollar_score");
    expect(result.credit_score.scoreKey).toBe("credit_score");
    expect(result.commodity_score.scoreKey).toBe("commodity_score");
    expect(result.china_score.scoreKey).toBe("china_score");
  });
});
