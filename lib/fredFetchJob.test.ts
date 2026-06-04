import { describe, expect, test } from "vitest";
import { runFredFetchJob } from "@/lib/fredFetchJob";

describe("runFredFetchJob", () => {
  test("continues after one series fails and reports inserted observations", async () => {
    const existing = new Set(["1:2026-01-02T00:00:00.000Z"]);
    const inserted: Array<{ indicatorId: number; date: Date; value: number }> = [];

    const report = await runFredFetchJob({
      apiKey: "test-key",
      observationStart: "2025-01-01",
      indicators: [
        { id: 1, symbol: "GOOD", fredSeriesId: "GOOD_SERIES" },
        { id: 2, symbol: "BAD", fredSeriesId: "BAD_SERIES" },
      ],
      fetchObservations: async (seriesId) => {
        if (seriesId === "BAD_SERIES") {
          throw new Error("FRED request failed for BAD_SERIES: 400 Bad Request");
        }
        return [
          { date: "2026-01-01", value: 1.25 },
          { date: "2026-01-02", value: 1.5 },
        ];
      },
      observationExists: async (indicatorId, date) => existing.has(`${indicatorId}:${date.toISOString()}`),
      insertObservation: async (data) => {
        inserted.push(data);
      },
      log: () => undefined,
    });

    expect(report).toEqual({
      indicatorsChecked: 2,
      success: 1,
      failed: 1,
      observationsInserted: 1,
      failures: [
        {
          symbol: "BAD",
          seriesId: "BAD_SERIES",
          reason: "FRED request failed for BAD_SERIES: 400 Bad Request",
        },
      ],
    });
    expect(inserted).toEqual([{ indicatorId: 1, date: new Date("2026-01-01T00:00:00.000Z"), value: 1.25 }]);
  });
});
