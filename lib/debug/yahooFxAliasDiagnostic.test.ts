import { describe, expect, test } from "vitest";
import {
  YAHOO_FX_ALIAS_CANDIDATES,
  buildYahooFxAliasDiagnostic,
  rankYahooFxAliasResults,
  summarizeYahooFxRows,
} from "@/lib/debug/yahooFxAliasDiagnostic";

function rows(count: number, startDate = "2020-01-01", startValue = 7) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return { date, close: startValue + index / 1000 };
  });
}

describe("yahooFxAliasDiagnostic", () => {
  test("uses the requested USDCNH candidate symbols", () => {
    expect(YAHOO_FX_ALIAS_CANDIDATES).toEqual(["CNH=X", "USDCNH=X", "CNHUSD=X", "CNY=X", "USDCNY=X"]);
  });

  test("summarizes GOOD, MINIMUM_OK, BAD, and FAILED statuses", () => {
    expect(summarizeYahooFxRows("GOOD", rows(500)).status).toBe("GOOD");
    expect(summarizeYahooFxRows("MIN", rows(30)).status).toBe("MINIMUM_OK");
    expect(summarizeYahooFxRows("BAD", rows(29)).status).toBe("BAD");

    const failed = summarizeYahooFxRows("FAIL", [], "Provider error");
    expect(failed.status).toBe("FAILED");
    expect(failed.errorMessage).toBe("Provider error");
  });

  test("keeps first/latest dates and sample values", () => {
    const result = summarizeYahooFxRows("USDCNH=X", rows(2, "2024-01-01", 7.1));

    expect(result.observationCount).toBe(2);
    expect(result.firstDate).toBe("2024-01-01");
    expect(result.latestDate).toBe("2024-01-02");
    expect(result.sampleFirstValue).toBe(7.1);
    expect(result.sampleLatestValue).toBe(7.101);
  });

  test("ranks by count, then earlier first date, then later latest date", () => {
    const ranked = rankYahooFxAliasResults([
      summarizeYahooFxRows("LOW", rows(20, "2020-01-01")),
      summarizeYahooFxRows("LATE", rows(500, "2021-01-01")),
      summarizeYahooFxRows("EARLY", rows(500, "2019-01-01")),
      summarizeYahooFxRows("FAILED", [], "error"),
    ]);

    expect(ranked.map((item) => item.symbol)).toEqual(["EARLY", "LATE", "LOW", "FAILED"]);
  });

  test("builds diagnostics without stopping when one candidate fails", async () => {
    const result = await buildYahooFxAliasDiagnostic({
      candidates: ["BAD", "GOOD"],
      fetchRows: async (symbol) => {
        if (symbol === "BAD") throw new Error("Yahoo failed");
        return rows(1000, "2018-01-01");
      },
    });

    expect(result.results).toHaveLength(2);
    expect(result.results.find((item) => item.symbol === "BAD")?.status).toBe("FAILED");
    expect(result.results.find((item) => item.symbol === "GOOD")?.isRecommended).toBe(true);
    expect(result.rankedResults[0]?.symbol).toBe("GOOD");
  });
});
