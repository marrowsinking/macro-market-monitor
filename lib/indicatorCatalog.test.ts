import { describe, expect, test } from "vitest";
import { indicatorCatalog } from "@/lib/indicatorCatalog";
import { getIndicatorVisibility } from "@/lib/indicators/indicatorVisibility";

const nfciSymbols = ["NFCI", "ANFCI", "NFCIRISK", "NFCICREDIT", "NFCILEVERAGE"];

describe("indicatorCatalog NFCI benchmark indicators", () => {
  test("includes Chicago Fed financial conditions benchmark series", () => {
    for (const symbol of nfciSymbols) {
      const indicator = indicatorCatalog.find((item) => item.symbol === symbol);

      expect(indicator).toMatchObject({
        symbol,
        source: "FRED",
        fredSeriesId: symbol,
        frequency: "weekly",
        category: "Financial Conditions / Benchmark",
        status: "active",
        isScoreInput: false,
        isCoreIndicator: false,
      });
    }
  });

  test("NFCI benchmarks are active but not official score inputs", () => {
    for (const symbol of nfciSymbols) {
      const indicator = indicatorCatalog.find((item) => item.symbol === symbol);
      if (!indicator) throw new Error(`Missing ${symbol}`);

      expect(getIndicatorVisibility(indicator)).toMatchObject({
        status: "active",
        isScoreInput: false,
        isCoreIndicator: false,
      });
    }
  });
});
