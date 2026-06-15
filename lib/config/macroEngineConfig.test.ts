import { describe, expect, test } from "vitest";
import { getAllMacroScoreConfigs, getMacroScoreConfig, getScorePolarityMultiplier, macroEngineConfig, macroScoreKeys } from "@/lib/config/macroEngineConfig";
import type { MacroScoreKey } from "@/lib/config/macroEngineConfig.types";

function factorPolarity(scoreKey: MacroScoreKey, symbol: string) {
  const factor = getMacroScoreConfig(scoreKey).factorGroups.flatMap((group) => group.factors).find((item) => item.symbol === symbol);
  if (!factor) throw new Error(`Missing factor ${symbol} in ${scoreKey}`);
  return factor.scorePolarity;
}

describe("macroEngineConfig", () => {
  test("defines exactly 8 score keys in dashboard order", () => {
    expect(macroScoreKeys).toEqual([
      "liquidity_score",
      "inflation_score",
      "growth_score",
      "risk_appetite_score",
      "dollar_score",
      "credit_score",
      "commodity_score",
      "china_score",
    ]);
    expect(Object.keys(macroEngineConfig.scores)).toHaveLength(8);
  });

  test("returns every score config by key", () => {
    for (const key of macroScoreKeys) {
      expect(getMacroScoreConfig(key).key).toBe(key);
    }
  });

  test("every score has required readable metadata", () => {
    for (const score of getAllMacroScoreConfigs()) {
      expect(score.zhName).toBeTruthy();
      expect(score.enName).toBeTruthy();
      expect(score.easyModeSubtitle).toBeTruthy();
      expect(score.professionalDescription).toBeTruthy();
      expect(score.methodologyTooltip).toBeTruthy();
    }
  });

  test("every score has at least one factor group", () => {
    for (const score of getAllMacroScoreConfigs()) {
      expect(score.factorGroups.length).toBeGreaterThan(0);
    }
  });

  test("inflation score defines the expected group structure", () => {
    const groups = getMacroScoreConfig("inflation_score").factorGroups.map((group) => group.key);

    expect(groups).toEqual(expect.arrayContaining(["headline_inflation", "core_inflation", "energy_inflation", "market_rate_confirmation"]));
  });

  test("commodity score separates growth-led commodities and defensive precious metals", () => {
    const groups = getMacroScoreConfig("commodity_score").factorGroups.map((group) => group.key);

    expect(groups).toEqual(expect.arrayContaining(["growth_led_commodities", "defensive_precious_metals"]));
  });

  test("china score is placeholder", () => {
    expect(getMacroScoreConfig("china_score").implementationStatus).toBe("placeholder");
  });

  test("all factor weights are non-negative", () => {
    for (const score of getAllMacroScoreConfigs()) {
      for (const group of score.factorGroups) {
        for (const factor of group.factors) {
          expect(factor.weight).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  test("non-placeholder score group maxContribution is non-negative", () => {
    for (const score of getAllMacroScoreConfigs()) {
      if (score.implementationStatus === "placeholder") continue;
      for (const group of score.factorGroups) {
        expect(group.maxContribution).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test("getAllMacroScoreConfigs preserves macroScoreKeys order", () => {
    expect(getAllMacroScoreConfigs().map((score) => score.key)).toEqual(macroScoreKeys);
  });

  test("all factors define scorePolarity", () => {
    for (const score of getAllMacroScoreConfigs()) {
      for (const group of score.factorGroups) {
        for (const factor of group.factors) {
          expect(factor.scorePolarity).toBeTruthy();
        }
      }
    }
  });

  test("inflation score factors increase inflation pressure score when higher", () => {
    for (const symbol of ["CPIAUCSL", "PCEPI", "CPILFESL", "PCEPILFE", "DCOILWTICO", "DGS10"]) {
      expect(factorPolarity("inflation_score", symbol)).toBe("higher_increases_score");
    }
  });

  test("dollar score factors increase dollar pressure score when higher", () => {
    for (const symbol of ["DX-Y.NYB", "JPY=X", "CNH=X", "DGS2", "SOFR"]) {
      expect(factorPolarity("dollar_score", symbol)).toBe("higher_increases_score");
    }
  });

  test("risk appetite core stress factors decrease risk appetite score when higher", () => {
    expect(factorPolarity("risk_appetite_score", "VIXCLS")).toBe("higher_decreases_score");
    expect(factorPolarity("risk_appetite_score", "BAMLH0A0HYM2")).toBe("higher_decreases_score");
  });

  test("credit spread decreases credit score when higher", () => {
    expect(factorPolarity("credit_score", "BAMLH0A0HYM2")).toBe("higher_decreases_score");
  });

  test("commodity cycle separates growth-led and context-dependent factors", () => {
    expect(factorPolarity("commodity_score", "HG=F")).toBe("higher_increases_score");
    expect(factorPolarity("commodity_score", "DCOILWTICO")).toBe("higher_increases_score");
    expect(factorPolarity("commodity_score", "GC=F")).toBe("context_dependent");
    expect(factorPolarity("commodity_score", "SI=F")).toBe("context_dependent");
    expect(factorPolarity("commodity_score", "GOLD_SILVER_RATIO")).toBe("context_dependent");
  });

  test("china placeholder factors are not scored", () => {
    for (const factor of getMacroScoreConfig("china_score").factorGroups.flatMap((group) => group.factors)) {
      expect(factor.scorePolarity).toBe("not_scored");
    }
  });

  test("maps scorePolarity to multiplier for future shadow score engine", () => {
    expect(getScorePolarityMultiplier("higher_increases_score")).toBe(1);
    expect(getScorePolarityMultiplier("higher_decreases_score")).toBe(-1);
    expect(getScorePolarityMultiplier("context_dependent")).toBe(0);
    expect(getScorePolarityMultiplier("not_scored")).toBe(0);
  });
});
