import { describe, expect, test } from "vitest";
import {
  CNY_BACKFILL_SYMBOL,
  backfillCnyObservations,
  type BackfillCnyStore,
  type CnyBackfillObservation,
} from "@/lib/backfill/cnyBackfill";

type FakeObservation = {
  id: number;
  indicatorId: number;
  date: Date;
  value: number;
};

function fakeStore(initialObservations: FakeObservation[] = []): BackfillCnyStore & { observations: FakeObservation[] } {
  const observations = [...initialObservations];
  let nextId = observations.length + 1;

  return {
    observations,
    async findObservation(indicatorId, date) {
      return observations.find((row) => row.indicatorId === indicatorId && row.date.getTime() === date.getTime()) ?? null;
    },
    async insertObservation(data) {
      observations.push({ id: nextId, ...data });
      nextId += 1;
    },
    async updateObservation(id, value) {
      const row = observations.find((observation) => observation.id === id);
      if (!row) throw new Error(`Missing observation ${id}`);
      row.value = value;
    },
    async getObservationSummary(indicatorId) {
      const rows = observations.filter((row) => row.indicatorId === indicatorId).sort((a, b) => a.date.getTime() - b.date.getTime());

      return {
        totalObservationCount: rows.length,
        firstDate: rows[0]?.date ?? null,
        latestDate: rows.at(-1)?.date ?? null,
      };
    },
  };
}

function point(date: string, value: number): CnyBackfillObservation {
  return { date: new Date(`${date}T00:00:00.000Z`), value };
}

describe("backfillCnyObservations", () => {
  test("rejects non-CNY symbols", async () => {
    await expect(
      backfillCnyObservations({
        indicator: { id: 1, symbol: "CNH=X" },
        observations: [point("2026-01-01", 7.1)],
        store: fakeStore(),
      }),
    ).rejects.toThrow("CNY=X");
  });

  test("inserts new CNY observations without touching other symbols", async () => {
    const store = fakeStore([{ id: 1, indicatorId: 99, date: point("2026-01-01", 150).date, value: 150 }]);

    const report = await backfillCnyObservations({
      indicator: { id: 8, symbol: CNY_BACKFILL_SYMBOL },
      observations: [point("2026-01-01", 7.1), point("2026-01-02", 7.2)],
      store,
    });

    expect(report.inserted).toBe(2);
    expect(report.updated).toBe(0);
    expect(report.skipped).toBe(0);
    expect(report.totalObservationCount).toBe(2);
    expect(store.observations.filter((row) => row.indicatorId === 99)).toHaveLength(1);
  });

  test("skips duplicate observations with the same value", async () => {
    const existingDate = point("2026-01-01", 7.1).date;
    const store = fakeStore([{ id: 1, indicatorId: 8, date: existingDate, value: 7.1 }]);

    const report = await backfillCnyObservations({
      indicator: { id: 8, symbol: CNY_BACKFILL_SYMBOL },
      observations: [point("2026-01-01", 7.1), point("2026-01-02", 7.2)],
      store,
    });

    expect(report.inserted).toBe(1);
    expect(report.updated).toBe(0);
    expect(report.skipped).toBe(1);
    expect(report.totalObservationCount).toBe(2);
    expect(store.observations.filter((row) => row.indicatorId === 8 && row.date.getTime() === existingDate.getTime())).toHaveLength(1);
  });

  test("updates same-date CNY observations when Yahoo returns a corrected close", async () => {
    const store = fakeStore([{ id: 1, indicatorId: 8, date: point("2026-01-01", 7.1).date, value: 7.1 }]);

    const report = await backfillCnyObservations({
      indicator: { id: 8, symbol: CNY_BACKFILL_SYMBOL },
      observations: [point("2026-01-01", 7.15)],
      store,
    });

    expect(report.inserted).toBe(0);
    expect(report.updated).toBe(1);
    expect(report.skipped).toBe(0);
    expect(store.observations.find((row) => row.indicatorId === 8)?.value).toBe(7.15);
  });

  test("returns first and latest date after backfill", async () => {
    const report = await backfillCnyObservations({
      indicator: { id: 8, symbol: CNY_BACKFILL_SYMBOL },
      observations: [point("2026-01-02", 7.2), point("2026-01-01", 7.1)],
      store: fakeStore(),
    });

    expect(report.firstDate?.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(report.latestDate?.toISOString().slice(0, 10)).toBe("2026-01-02");
  });
});
