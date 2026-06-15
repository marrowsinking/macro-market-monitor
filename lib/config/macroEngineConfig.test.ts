import { describe, expect, test } from "vitest";
import {
  getAllConfiguredFactors,
  getAllFactorsForScore,
  getAllMacroScoreConfigs,
  getMacroScoreConfig,
  getScorePolarityMultiplier,
  macroEngineConfig,
  macroScoreKeys,
} from "@/lib/config/macroEngineConfig";
import type { MacroScoreKey } from "@/lib/config/macroEngineConfig.types";

function findFactor(scoreKey: MacroScoreKey, symbol: string) {
  const factor = getMacroScoreConfig(scoreKey).factorGroups.flatMap((group) => group.factors).find((item) => item.symbol === symbol);
  if (!factor) throw new Error(`Missing factor ${symbol} in ${scoreKey}`);
  return factor;
}

function factorPolarity(scoreKey: MacroScoreKey, symbol: string) {
  const factor = findFactor(scoreKey, symbol);
  return factor.scorePolarity;
}

function factorTransform(scoreKey: MacroScoreKey, symbol: string) {
  const factor = findFactor(scoreKey, symbol);
  return factor.signalTransform;
}

function firstWindow(scoreKey: MacroScoreKey, symbol: string) {
  const factor = findFactor(scoreKey, symbol);
  return factor.preferredZScoreWindows[0];
}

function transformLookback(scoreKey: MacroScoreKey, symbol: string) {
  const factor = findFactor(scoreKey, symbol);
  return factor.transformLookbackDays;
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
    for (const symbol of ["DX-Y.NYB", "JPY=X", "CNY=X", "DGS2", "SOFR"]) {
      expect(factorPolarity("dollar_score", symbol)).toBe("higher_increases_score");
    }
  });

  test("dollar score uses CNY=X instead of CNH=X as yuan pressure proxy", () => {
    const dollarSymbols = getAllFactorsForScore("dollar_score").map((factor) => factor.symbol);
    const cny = findFactor("dollar_score", "CNY=X");

    expect(dollarSymbols).toContain("CNY=X");
    expect(dollarSymbols).not.toContain("CNH=X");
    expect(cny.name).toBe("USDCNY");
    expect(cny.scorePolarity).toBe("higher_increases_score");
    expect(cny.signalTransform).toBe("level");
    expect(cny.preferredZScoreWindows[0]).toBe(60);
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

  test("all factors define normalization metadata", () => {
    for (const factor of getAllConfiguredFactors()) {
      expect(factor.signalTransform).toBeTruthy();
      expect(factor.minObservations).toBeGreaterThanOrEqual(0);
      expect(factor.normalizationNote).toBeTruthy();
    }
  });

  test("transforms with lookback define transformLookbackDays", () => {
    for (const factor of getAllConfiguredFactors()) {
      if (["pct_change", "level_change", "derived_ratio"].includes(factor.signalTransform)) {
        expect(factor.transformLookbackDays).toBeGreaterThan(0);
      }
    }
  });

  test("inflation score uses non-level transforms for price indices", () => {
    for (const symbol of ["CPIAUCSL", "PCEPI", "CPILFESL", "PCEPILFE"]) {
      expect(factorTransform("inflation_score", symbol)).toBe("yoy_pct");
    }
    expect(factorTransform("inflation_score", "DCOILWTICO")).toBe("pct_change");
    expect(factorTransform("inflation_score", "DGS10")).toBe("level");
  });

  test("growth score uses momentum and level transforms by series type", () => {
    expect(factorTransform("growth_score", "PAYEMS")).toBe("mom_change");
    expect(factorTransform("growth_score", "JTSJOL")).toBe("yoy_pct");
    expect(factorTransform("growth_score", "UNRATE")).toBe("level");
    expect(factorTransform("growth_score", "ICSA")).toBe("level");
  });

  test("risk appetite score uses market-stress and momentum transforms", () => {
    expect(factorTransform("risk_appetite_score", "^GSPC")).toBe("pct_change");
    expect(factorTransform("risk_appetite_score", "^NDX")).toBe("pct_change");
    expect(factorTransform("risk_appetite_score", "VIXCLS")).toBe("level");
    expect(factorTransform("risk_appetite_score", "BAMLH0A0HYM2")).toBe("level");
    expect(factorTransform("risk_appetite_score", "DGS10")).toBe("level_change");
  });

  test("commodity score separates momentum and derived ratio transforms", () => {
    for (const symbol of ["HG=F", "DCOILWTICO", "GC=F", "SI=F"]) {
      expect(factorTransform("commodity_score", symbol)).toBe("pct_change");
    }
    expect(factorTransform("commodity_score", "GOLD_SILVER_RATIO")).toBe("derived_ratio");
  });

  test("china placeholder factors are not transformed for scoring", () => {
    for (const factor of getAllFactorsForScore("china_score")) {
      expect(factor.signalTransform).toBe("not_scored");
      expect(factor.minObservations).toBe(0);
    }
  });

  test("getAllFactorsForScore returns all inflation factors", () => {
    expect(getAllFactorsForScore("inflation_score")).toHaveLength(6);
  });

  test("getAllConfiguredFactors returns factors without de-duplicating repeated symbols", () => {
    const factors = getAllConfiguredFactors();
    expect(factors.length).toBeGreaterThan(0);
    expect(factors.filter((factor) => factor.symbol === "BAMLH0A0HYM2").length).toBeGreaterThan(1);
  });

  test("monthly macro factors use long rolling windows for sparse observations", () => {
    const monthlyFactors = getAllConfiguredFactors().filter((factor) => factor.frequency === "monthly_macro" && factor.signalTransform !== "not_scored");

    for (const factor of monthlyFactors) {
      expect(factor.preferredZScoreWindows[0]).toBeGreaterThanOrEqual(730);
    }
  });

  test("monthly macro factors with higher minimum observations start at 730 days or longer", () => {
    const monthlyFactors = getAllConfiguredFactors().filter(
      (factor) => factor.frequency === "monthly_macro" && factor.signalTransform !== "not_scored" && factor.minObservations >= 18,
    );

    for (const factor of monthlyFactors) {
      expect(factor.preferredZScoreWindows[0]).toBeGreaterThanOrEqual(730);
    }
  });

  test("weekly factors with higher minimum observations start at 252 days or longer", () => {
    const weeklyFactors = getAllConfiguredFactors().filter(
      (factor) => factor.frequency === "weekly" && factor.signalTransform !== "not_scored" && factor.minObservations >= 20,
    );

    for (const factor of weeklyFactors) {
      expect(factor.preferredZScoreWindows[0]).toBeGreaterThanOrEqual(252);
    }
  });

  test("non-placeholder scored factors define preferred z-score windows", () => {
    const scoredFactors = getAllConfiguredFactors().filter((factor) => factor.frequency !== "placeholder" && factor.signalTransform !== "not_scored");

    for (const factor of scoredFactors) {
      expect(factor.preferredZScoreWindows.length).toBeGreaterThan(0);
    }
  });

  test("monthly macro factors use the expected first z-score window", () => {
    expect(firstWindow("inflation_score", "CPIAUCSL")).toBe(730);
    expect(firstWindow("inflation_score", "PCEPI")).toBe(730);
    expect(firstWindow("inflation_score", "CPILFESL")).toBe(730);
    expect(firstWindow("inflation_score", "PCEPILFE")).toBe(730);
    expect(firstWindow("growth_score", "PAYEMS")).toBe(730);
    expect(firstWindow("growth_score", "JTSJOL")).toBe(730);
    expect(firstWindow("growth_score", "UNRATE")).toBe(730);
  });

  test("weekly macro factors use the expected first z-score window", () => {
    expect(firstWindow("liquidity_score", "WALCL")).toBe(252);
    expect(firstWindow("growth_score", "ICSA")).toBe(252);
  });

  test("daily market scored factors with higher minimum observations do not default to 30 calendar days", () => {
    const dailyMarketFactors = getAllConfiguredFactors().filter(
      (factor) =>
        factor.frequency === "daily_market" &&
        factor.minObservations >= 30 &&
        factor.scorePolarity !== "not_scored" &&
        factor.signalTransform !== "not_scored",
    );

    for (const factor of dailyMarketFactors) {
      expect(factor.preferredZScoreWindows[0]).toBeGreaterThanOrEqual(60);
    }
  });

  test("daily rate scored factors with higher minimum observations do not default to 30 calendar days", () => {
    const dailyRateFactors = getAllConfiguredFactors().filter(
      (factor) =>
        factor.frequency === "daily_rate" &&
        factor.minObservations >= 30 &&
        factor.scorePolarity !== "not_scored" &&
        factor.signalTransform !== "not_scored",
    );

    for (const factor of dailyRateFactors) {
      expect(factor.preferredZScoreWindows[0]).toBeGreaterThanOrEqual(60);
    }
  });

  test("daily market factors use 60-day rolling z-score windows by default", () => {
    expect(firstWindow("risk_appetite_score", "VIXCLS")).toBe(60);
    expect(firstWindow("risk_appetite_score", "^GSPC")).toBe(60);
    expect(firstWindow("risk_appetite_score", "^NDX")).toBe(60);
    expect(firstWindow("dollar_score", "DX-Y.NYB")).toBe(60);
    expect(firstWindow("dollar_score", "JPY=X")).toBe(60);
    expect(firstWindow("dollar_score", "CNY=X")).toBe(60);
    expect(firstWindow("commodity_score", "HG=F")).toBe(60);
    expect(firstWindow("commodity_score", "DCOILWTICO")).toBe(60);
    expect(firstWindow("commodity_score", "GC=F")).toBe(60);
    expect(firstWindow("commodity_score", "SI=F")).toBe(60);
    expect(firstWindow("commodity_score", "GOLD_SILVER_RATIO")).toBe(60);
    expect(firstWindow("inflation_score", "DCOILWTICO")).toBe(60);
  });

  test("30-day signal transforms keep transformLookbackDays at 30", () => {
    expect(transformLookback("risk_appetite_score", "^GSPC")).toBe(30);
    expect(transformLookback("risk_appetite_score", "^NDX")).toBe(30);
    expect(transformLookback("commodity_score", "HG=F")).toBe(30);
    expect(transformLookback("commodity_score", "DCOILWTICO")).toBe(30);
    expect(transformLookback("commodity_score", "GC=F")).toBe(30);
    expect(transformLookback("commodity_score", "SI=F")).toBe(30);
    expect(transformLookback("commodity_score", "GOLD_SILVER_RATIO")).toBe(30);
    expect(transformLookback("inflation_score", "DCOILWTICO")).toBe(30);
  });
});
