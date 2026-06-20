import { loadEnvConfig } from "@next/env";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";
import { CREDIT_SPREAD_BACKFILL_SYMBOL, backfillCreditSpreadObservations } from "../lib/backfill/creditSpreadBackfill";
import { indicatorCatalog } from "../lib/indicatorCatalog";
import { assertFredApiKey } from "../lib/fred";
import { createFredFetcher } from "../lib/providers/fredProvider";
import { toIndicatorSeedRow } from "../lib/seed/indicatorSeedData";

loadEnvConfig(process.cwd());

const OBSERVATION_START = "2017-01-01";
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" });
const prisma = new PrismaClient({ adapter });

function formatDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "null";
}

async function main() {
  const seed = indicatorCatalog.find((item) => item.symbol === CREDIT_SPREAD_BACKFILL_SYMBOL);
  if (!seed) {
    throw new Error(`${CREDIT_SPREAD_BACKFILL_SYMBOL} is not configured in indicatorCatalog.`);
  }

  const data = toIndicatorSeedRow(seed);
  const indicator = await prisma.indicator.upsert({
    where: { symbol: CREDIT_SPREAD_BACKFILL_SYMBOL },
    update: data,
    create: data,
  });

  console.log(`${CREDIT_SPREAD_BACKFILL_SYMBOL} credit spread backfill started:`);
  console.log(`- indicatorId: ${indicator.id}`);
  console.log(`- period: ${OBSERVATION_START} to latest available`);

  const fetcher = createFredFetcher({
    apiKey: assertFredApiKey(),
    observationStart: OBSERVATION_START,
  });
  const query = fetcher.transformQuery(indicator);
  const raw = await fetcher.extractData(query);
  const transformed = fetcher.transformData(raw, indicator);

  if (transformed.observations.length < 30) {
    console.warn(`FRED provider returned only ${transformed.observations.length} observations for ${CREDIT_SPREAD_BACKFILL_SYMBOL}.`);
  }

  const report = await backfillCreditSpreadObservations({
    indicator,
    observations: transformed.observations,
    store: {
      findObservation: async (indicatorId, date) =>
        prisma.observation.findUnique({
          where: {
            indicatorId_date: {
              indicatorId,
              date,
            },
          },
          select: {
            id: true,
            value: true,
          },
        }),
      insertObservation: async (observation) => {
        await prisma.observation.create({ data: observation });
      },
      updateObservation: async (id, value) => {
        await prisma.observation.update({
          where: { id },
          data: { value },
        });
      },
      getObservationSummary: async (indicatorId) => {
        const [totalObservationCount, first, latest] = await Promise.all([
          prisma.observation.count({ where: { indicatorId } }),
          prisma.observation.findFirst({
            where: { indicatorId },
            orderBy: { date: "asc" },
            select: { date: true },
          }),
          prisma.observation.findFirst({
            where: { indicatorId },
            orderBy: { date: "desc" },
            select: { date: true },
          }),
        ]);

        return {
          totalObservationCount,
          firstDate: first?.date ?? null,
          latestDate: latest?.date ?? null,
        };
      },
    },
  });

  console.log(`${CREDIT_SPREAD_BACKFILL_SYMBOL} credit spread backfill completed:`);
  console.log(`- inserted: ${report.inserted}`);
  console.log(`- updated: ${report.updated}`);
  console.log(`- skipped: ${report.skipped}`);
  console.log(`- firstDate: ${formatDate(report.firstDate)}`);
  console.log(`- latestDate: ${formatDate(report.latestDate)}`);
  console.log(`- total observations after backfill: ${report.totalObservationCount}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
