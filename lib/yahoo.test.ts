import { describe, expect, test } from "vitest";
import { normalizeYahooHistoricalRows } from "@/lib/yahoo";

describe("normalizeYahooHistoricalRows", () => {
  test("skips rows without valid close prices", () => {
    expect(
      normalizeYahooHistoricalRows([
        { date: new Date("2026-01-01T00:00:00.000Z"), close: null },
        { date: new Date("2026-01-02T00:00:00.000Z"), close: undefined },
        { date: new Date("2026-01-03T00:00:00.000Z"), close: Number.NaN },
        { date: new Date("2026-01-04T00:00:00.000Z"), close: 123.45 },
      ]),
    ).toEqual([{ date: "2026-01-04", close: 123.45 }]);
  });
});
