import { describe, expect, test } from "vitest";
import { createFredFetcher } from "@/lib/providers/fredProvider";

describe("createFredFetcher", () => {
  test("skips invalid FRED observation values", () => {
    const fetcher = createFredFetcher({ apiKey: "test" });
    const result = fetcher.transformData(
      {
        observations: [
          { date: "2026-01-01", value: "1.25" },
          { date: "2026-01-02", value: "." },
          { date: "2026-01-03", value: null },
          { date: "2026-01-04", value: "" },
          { date: "2026-01-05", value: "not-a-number" },
        ],
      },
      { id: 1, symbol: "DGS10", fredSeriesId: "DGS10" },
    );

    expect(result.skipped).toBe(4);
    expect(result.observations).toEqual([
      {
        date: new Date("2026-01-01T00:00:00.000Z"),
        value: 1.25,
      },
    ]);
  });
});
