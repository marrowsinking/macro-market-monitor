export const CNH_BACKFILL_SYMBOL = "CNH=X";

export type CnhBackfillObservation = {
  date: Date;
  value: number;
};

export type CnhBackfillIndicator = {
  id: number;
  symbol: string;
};

export type BackfillCnhStore = {
  findObservation: (
    indicatorId: number,
    date: Date,
  ) => Promise<{
    id: number;
    value: number;
  } | null>;
  insertObservation: (data: { indicatorId: number; date: Date; value: number }) => Promise<void>;
  updateObservation: (id: number, value: number) => Promise<void>;
  getObservationSummary: (indicatorId: number) => Promise<{
    totalObservationCount: number;
    firstDate: Date | null;
    latestDate: Date | null;
  }>;
};

export type CnhBackfillReport = {
  symbol: typeof CNH_BACKFILL_SYMBOL;
  inserted: number;
  updated: number;
  skipped: number;
  firstDate: Date | null;
  latestDate: Date | null;
  totalObservationCount: number;
};

function sameValue(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-12;
}

function validObservation(observation: CnhBackfillObservation): boolean {
  return observation.date instanceof Date && !Number.isNaN(observation.date.getTime()) && Number.isFinite(observation.value);
}

export async function backfillCnhObservations(input: {
  indicator: CnhBackfillIndicator;
  observations: CnhBackfillObservation[];
  store: BackfillCnhStore;
}): Promise<CnhBackfillReport> {
  if (input.indicator.symbol !== CNH_BACKFILL_SYMBOL) {
    throw new Error(`CNH backfill only supports ${CNH_BACKFILL_SYMBOL}. Received ${input.indicator.symbol}.`);
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const observation of input.observations) {
    if (!validObservation(observation)) {
      skipped += 1;
      continue;
    }

    const existing = await input.store.findObservation(input.indicator.id, observation.date);
    if (!existing) {
      await input.store.insertObservation({
        indicatorId: input.indicator.id,
        date: observation.date,
        value: observation.value,
      });
      inserted += 1;
      continue;
    }

    if (sameValue(existing.value, observation.value)) {
      skipped += 1;
      continue;
    }

    await input.store.updateObservation(existing.id, observation.value);
    updated += 1;
  }

  const summary = await input.store.getObservationSummary(input.indicator.id);

  return {
    symbol: CNH_BACKFILL_SYMBOL,
    inserted,
    updated,
    skipped,
    ...summary,
  };
}
