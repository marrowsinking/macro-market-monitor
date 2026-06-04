import { describe, expect, test } from "vitest";
import { runFetchJob } from "@/lib/providers/fetchJob";
import { ProviderFetchError, type ProviderFetcher, type ProviderIndicator } from "@/lib/providers/types";

type TestRaw = {
  fail?: boolean;
  observations: Array<{ date: Date; value: number }>;
  skipped: number;
};

function testFetcher(rawBySymbol: Record<string, TestRaw>): ProviderFetcher<ProviderIndicator, { symbol: string }, TestRaw> {
  return {
    provider: "MANUAL",
    transformQuery(indicator) {
      return { symbol: indicator.symbol };
    },
    async extractData(query) {
      const raw = rawBySymbol[query.symbol];
      if (!raw || raw.fail) {
        throw new ProviderFetchError({
          provider: "MANUAL",
          type: "PROVIDER_ERROR",
          message: `${query.symbol} failed`,
        });
      }
      return raw;
    },
    transformData(raw) {
      return {
        observations: raw.observations,
        skipped: raw.skipped,
      };
    },
  };
}

describe("runFetchJob", () => {
  test("does not stop the full job when one indicator fails", async () => {
    const inserted: Array<{ indicatorId: number; date: Date; value: number }> = [];
    const result = await runFetchJob({
      fetcher: testFetcher({
        OK: {
          observations: [{ date: new Date("2026-01-01T00:00:00.000Z"), value: 1 }],
          skipped: 0,
        },
        BAD: {
          fail: true,
          observations: [],
          skipped: 0,
        },
      }),
      indicators: [
        { id: 1, symbol: "OK" },
        { id: 2, symbol: "BAD" },
      ],
      observationExists: async () => false,
      insertObservation: async (data) => {
        inserted.push(data);
      },
    });

    expect(result.success).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.observationsInserted).toBe(1);
    expect(result.errors).toEqual([
      {
        indicatorId: 2,
        symbol: "BAD",
        provider: "MANUAL",
        type: "PROVIDER_ERROR",
        message: "BAD failed",
      },
    ]);
    expect(inserted).toHaveLength(1);
  });

  test("skips duplicate observations instead of inserting them again", async () => {
    const inserted: Array<{ indicatorId: number; date: Date; value: number }> = [];
    const duplicateDate = new Date("2026-01-01T00:00:00.000Z");
    const result = await runFetchJob({
      fetcher: testFetcher({
        TEST: {
          observations: [
            { date: duplicateDate, value: 1 },
            { date: new Date("2026-01-02T00:00:00.000Z"), value: 2 },
          ],
          skipped: 1,
        },
      }),
      indicators: [{ id: 1, symbol: "TEST" }],
      observationExists: async (_indicatorId, date) => date.getTime() === duplicateDate.getTime(),
      insertObservation: async (data) => {
        inserted.push(data);
      },
    });

    expect(result.success).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.observationsInserted).toBe(1);
    expect(result.observationsSkipped).toBe(2);
    expect(inserted).toEqual([
      {
        indicatorId: 1,
        date: new Date("2026-01-02T00:00:00.000Z"),
        value: 2,
      },
    ]);
  });
});
