import { describe, expect, test } from "vitest";
import { generateResearchNarrative } from "@/lib/dashboard/researchNarrative";

function regime(overrides: Partial<Parameters<typeof generateResearchNarrative>[0]["latestRegime"]> = {}) {
  return {
    finalRegime: "風險偏好模式",
    liquidityScore: 1,
    inflationScore: 1,
    growthScore: 1,
    riskAppetiteScore: 4,
    dollarScore: 0,
    creditScore: 3,
    commodityScore: 1,
    chinaScore: 0,
    ...overrides,
  };
}

describe("generateResearchNarrative", () => {
  test("mentions not clean risk-on when risk appetite has high dollar pressure", () => {
    const narrative = generateResearchNarrative({
      latestRegime: regime({ dollarScore: 2, inflationScore: 3 }),
    });

    expect(narrative.conclusion).toContain("不是完全乾淨 risk-on");
  });

  test("describes previous to current regime changes", () => {
    const narrative = generateResearchNarrative({
      latestRegime: regime({ finalRegime: "風險偏好模式" }),
      previousRegime: regime({ finalRegime: "高利率風險偏好環境", liquidityScore: -1 }),
    });

    expect(narrative.changes.join(" ")).toContain("高利率風險偏好環境");
    expect(narrative.changes.join(" ")).toContain("風險偏好模式");
  });

  test("describes concrete score changes when regime changes", () => {
    const narrative = generateResearchNarrative({
      latestRegime: regime({
        finalRegime: "避險模式",
        riskAppetiteScore: 0,
        creditScore: -1,
        dollarScore: 4.5,
      }),
      previousRegime: regime({
        finalRegime: "風險偏好模式",
        riskAppetiteScore: 4,
        creditScore: 3,
        dollarScore: 2.5,
      }),
      scoreChanges: {
        liquidityScore: { previous: 1, current: 1, change: 0 },
        inflationScore: { previous: 1, current: 1, change: 0 },
        growthScore: { previous: 1, current: 1, change: 0 },
        riskAppetiteScore: { previous: 4, current: 0, change: -4 },
        dollarScore: { previous: 2.5, current: 4.5, change: 2 },
        creditScore: { previous: 3, current: -1, change: -4 },
        commodityScore: { previous: 1, current: 1, change: 0 },
        chinaScore: { previous: 0, current: 0, change: 0 },
      },
    });

    const text = narrative.changes.join(" ");
    expect(text).toContain("已確認 regime 從「風險偏好模式」轉為「避險模式」");
    expect(text).toContain("risk_appetite_score: +4.0 → 0.0");
    expect(text).toContain("credit_score: +3.0 → -1.0");
    expect(text).toContain("dollar_score: +2.5 → +4.5");
  });

  test("generates one-line most important change summary", () => {
    const narrative = generateResearchNarrative({
      latestRegime: regime({
        finalRegime: "風險偏好模式",
        liquidityScore: 1.5,
        riskAppetiteScore: 2,
        dollarScore: 2.5,
        commodityScore: -4,
      }),
      previousRegime: regime({
        finalRegime: "混合震盪模式",
        liquidityScore: 1.5,
        riskAppetiteScore: 0,
        dollarScore: 4.5,
        commodityScore: -2,
      }),
      scoreChanges: {
        liquidityScore: { previous: 1.5, current: 1.5, change: 0 },
        inflationScore: { previous: 1, current: 1, change: 0 },
        growthScore: { previous: 1, current: 1, change: 0 },
        riskAppetiteScore: { previous: 0, current: 2, change: 2 },
        dollarScore: { previous: 4.5, current: 2.5, change: -2 },
        creditScore: { previous: 3, current: 3, change: 0 },
        commodityScore: { previous: -2, current: -4, change: -2 },
        chinaScore: { previous: 0, current: 0, change: 0 },
      },
    });

    expect(narrative.importantChange).toContain("Regime 切換主因：");
    expect(narrative.importantChange).toContain("風險偏好由 0.0 升至 +2.0");
    expect(narrative.importantChange).toContain("美元壓力由 +4.5 回落至 +2.5");
    expect(narrative.importantChange).toContain("商品週期由 -2.0 進一步降至 -4.0");
    expect(narrative.importantChange).not.toContain("流動性");
  });

  test("mentions commodities not confirming when commodity score is negative", () => {
    const narrative = generateResearchNarrative({
      latestRegime: regime({ commodityScore: -1 }),
      previousRegime: regime({ commodityScore: 1 }),
    });

    expect([...narrative.why, ...narrative.changes, ...narrative.conflicts].join(" ")).toContain("商品端沒有配合");
  });

  test("does not make a strong directional claim for mixed regime", () => {
    const narrative = generateResearchNarrative({
      latestRegime: regime({ finalRegime: "混合震盪模式", riskAppetiteScore: 0, creditScore: 0 }),
    });

    expect(narrative.conclusion).toContain("不宜給出過強方向性結論");
    expect(narrative.tone).toBe("mixed");
  });

  test("does not throw when data is insufficient", () => {
    const narrative = generateResearchNarrative({
      latestRegime: null,
      previousRegime: null,
      keyDrivers: [],
      conflictingSignals: [],
      watchNext: [],
    });

    expect(narrative.headline).toContain("資料不足");
    expect(narrative.why.length).toBeGreaterThan(0);
  });
});
