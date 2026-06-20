import { describe, expect, test } from "vitest";
import {
  CREDIT_SPREAD_BACKFILL_SYMBOL,
  backfillCreditSpreadObservations,
  type BackfillCreditSpreadStore,
  type CreditSpreadBackfillObservation,
} from "@/lib/backfill/creditSpreadBackfill";

type FakeObservation = {
  id: number;
  indicatorId: number;
  date: Date;
  value: number;
};

function point(date: string, value: number): CreditSpreadBackfillObservation {
  return { date: new Date(`${date}T00:00:00.000Z`), value };
}

function fakeStore(initialObservations: FakeObservation[] = []): BackfillCreditSpreadStore & { observations: FakeObservation[] } {
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

describe("backfillCreditSpreadObservations", () => {
  test("rejects non-credit-spread symbols", async () => {
    await expect(
      backfillCreditSpreadObservations({
        indicator: { id: 1, symbol: "DGS10" },
        observations: [point("2020-01-01", 1.5)],
        store: fakeStore(),
      }),
    ).rejects.toThrow(CREDIT_SPREAD_BACKFILL_SYMBOL);
  });

  test("inserts new BAMLH0A0HYM2 observations without touching other indicators", async () => {
    const store = fakeStore([{ id: 1, indicatorId: 99, date: point("2020-01-01", 2).date, value: 2 }]);
    const report = await backfillCreditSpreadObservations({
      indicator: { id: 8, symbol: CREDIT_SPREAD_BACKFILL_SYMBOL },
      observations: [point("2020-01-01", 4.5), point("2020-01-02", 4.7)],
      store,
    });

    expect(report.inserted).toBe(2);
    expect(report.updated).toBe(0);
    expect(report.skipped).toBe(0);
    expect(report.totalObservationCount).toBe(2);
    expect(store.observations.filter((row) => row.indicatorId === 99)).toHaveLength(1);
  });

  test("skips same-date observations with the same value", async () => {
    const existingDate = point("2020-01-01", 4.5).date;
    const store = fakeStore([{ id: 1, indicatorId: 8, date: existingDate, value: 4.5 }]);
    const report = await backfillCreditSpreadObservations({
      indicator: { id: 8, symbol: CREDIT_SPREAD_BACKFILL_SYMBOL },
      observations: [point("2020-01-01", 4.5), point("2020-01-02", 4.7)],
      store,
    });

    expect(report.inserted).toBe(1);
    expect(report.updated).toBe(0);
    expect(report.skipped).toBe(1);
    expect(store.observations.filter((row) => row.indicatorId === 8 && row.date.getTime() === existingDate.getTime())).toHaveLength(1);
  });

  test("updates same-date observations when FRED returns a corrected value", async () => {
    const store = fakeStore([{ id: 1, indicatorId: 8, date: point("2020-01-01", 4.5).date, value: 4.5 }]);
    const report = await backfillCreditSpreadObservations({
      indicator: { id: 8, symbol: CREDIT_SPREAD_BACKFILL_SYMBOL },
      observations: [point("2020-01-01", 4.6)],
      store,
    });

    expect(report.inserted).toBe(0);
    expect(report.updated).toBe(1);
    expect(report.skipped).toBe(0);
    expect(store.observations.find((row) => row.indicatorId === 8)?.value).toBe(4.6);
  });

  test("skips invalid observations and returns first/latest dates", async () => {
    const report = await backfillCreditSpreadObservations({
      indicator: { id: 8, symbol: CREDIT_SPREAD_BACKFILL_SYMBOL },
      observations: [
        point("2020-01-02", 4.7),
        point("2020-01-01", 4.5),
        { date: new Date("bad-date"), value: 1 },
        { date: point("2020-01-03", 1).date, value: Number.NaN },
      ],
      store: fakeStore(),
    });

    expect(report.inserted).toBe(2);
    expect(report.skipped).toBe(2);
    expect(report.firstDate?.toISOString().slice(0, 10)).toBe("2020-01-01");
    expect(report.latestDate?.toISOString().slice(0, 10)).toBe("2020-01-02");
  });
});
