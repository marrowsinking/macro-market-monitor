import { describe, expect, test } from "vitest";
import {
  buildShadowScoreDebugQuery,
  formatDebugNumber,
  shadowScoreDebugOrder,
  statusTone,
} from "@/lib/debug/shadowScoreDebugView";

describe("shadowScoreDebugView", () => {
  test("keeps score cards in macro score order", () => {
    expect(shadowScoreDebugOrder).toEqual([
      "liquidity_score",
      "inflation_score",
      "growth_score",
      "risk_appetite_score",
      "dollar_score",
      "credit_score",
      "commodity_score",
      "china_score",
    ]);
  });

  test("formats debug numbers with signs and dashes", () => {
    expect(formatDebugNumber(1.234)).toBe("+1.23");
    expect(formatDebugNumber(-0.8)).toBe("-0.80");
    expect(formatDebugNumber(0)).toBe("0.00");
    expect(formatDebugNumber(null)).toBe("—");
  });

  test("maps statuses to semantic tones", () => {
    expect(statusTone("ok")).toBe("green");
    expect(statusTone("partial")).toBe("amber");
    expect(statusTone("missing_observations")).toBe("amber");
    expect(statusTone("invalid_data")).toBe("red");
    expect(statusTone("not_scored")).toBe("gray");
  });

  test("builds API query from enabled controls only", () => {
    expect(buildShadowScoreDebugQuery({ preferredWindow: "252", zScoreForFullSignal: "2", summary: true })).toBe(
      "preferredWindow=252&zScoreForFullSignal=2&summary=1",
    );
    expect(buildShadowScoreDebugQuery({ preferredWindow: "", zScoreForFullSignal: "", summary: false })).toBe("");
  });
});
