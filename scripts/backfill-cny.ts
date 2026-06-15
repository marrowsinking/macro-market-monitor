import { loadEnvConfig } from "@next/env";
import { subYears } from "date-fns";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";
import { CNY_BACKFILL_SYMBOL, backfillCnyObservations } from "../lib/backfill/cnyBackfill";
import { createYahooFetcher, yahooAssets } from "../lib/providers/yahooProvider";

loadEnvConfig(process.cwd());

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" });
const prisma = new PrismaClient({ adapter });

function formatDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "null";
}

async function main() {
  const cnyAsset = yahooAssets.find((asset) => asset.symbol === CNY_BACKFILL_SYMBOL);
  if (!cnyAsset) {
    throw new Error(`${CNY_BACKFILL_SYMBOL} is not configured in yahooAssets.`);
  }

  const indicator = await prisma.indicator.upsert({
    where: { symbol: CNY_BACKFILL_SYMBOL },
    update: {
      name: cnyAsset.name,
      category: cnyAsset.category,
      source: "YAHOO",
      fredSeriesId: null,
      frequency: "daily",
      description: cnyAsset.description,
      macroLogic: cnyAsset.macroLogic,
    },
    create: {
      name: cnyAsset.name,
      symbol: cnyAsset.symbol,
      category: cnyAsset.category,
      source: "YAHOO",
      fredSeriesId: null,
      frequency: "daily",
      description: cnyAsset.description,
      macroLogic: cnyAsset.macroLogic,
    },
  });

  console.log(`${CNY_BACKFILL_SYMBOL} backfill started:`);
  console.log(`- indicatorId: ${indicator.id}`);
  console.log(`- period: ${formatDate(subYears(new Date(), 10))} to ${formatDate(new Date())}`);

  const fetcher = createYahooFetcher({
    period1: subYears(new Date(), 10),
    period2: new Date(),
    interval: "1d",
  });
  const query = fetcher.transformQuery(indicator);
  const raw = await fetcher.extractData(query);
  const transformed = fetcher.transformData(raw, indicator);

  if (transformed.observations.length < 30) {
    console.warn(`Yahoo provider returned only ${transformed.observations.length} observations for ${CNY_BACKFILL_SYMBOL}.`);
  }

  const report = await backfillCnyObservations({
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
      insertObservation: async (data) => {
        await prisma.observation.create({ data });
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

  console.log(`${CNY_BACKFILL_SYMBOL} backfill completed:`);
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
