import { describe, expect, test } from "vitest";
import { createYahooFetcher } from "@/lib/providers/yahooProvider";

describe("createYahooFetcher", () => {
  test("uses close price and skips invalid rows", () => {
    const fetcher = createYahooFetcher({ period1: new Date("2025-01-01T00:00:00.000Z") });
    const result = fetcher.transformData(
      [
        { date: new Date("2026-01-01T12:00:00.000Z"), close: 100 },
        { date: new Date("2026-01-02T12:00:00.000Z"), close: null },
        { date: new Date("2026-01-03T12:00:00.000Z"), close: undefined },
        { date: new Date("2026-01-04T12:00:00.000Z"), close: Number.NaN },
        { date: null, close: 101 },
      ],
      { id: 1, symbol: "^GSPC" },
    );

    expect(result.skipped).toBe(4);
    expect(result.observations).toEqual([
      {
        date: new Date("2026-01-01T00:00:00.000Z"),
        value: 100,
      },
    ]);
  });
});
