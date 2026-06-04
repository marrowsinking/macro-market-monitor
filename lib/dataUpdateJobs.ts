import { subYears } from "date-fns";
import type { PrismaClient } from "@/generated/prisma/client";
import { calculateAllIndicatorStats } from "@/lib/calculateIndicators";
import { evaluateMacroAlerts } from "@/lib/alertEngine";
import { calculateMacroRegime, type MacroRegimeResult } from "@/lib/regimeEngine";
import { createFredFetcher } from "@/lib/providers/fredProvider";
import { runFetchJob } from "@/lib/providers/fetchJob";
import type { FetchJobResult } from "@/lib/providers/types";
import { createYahooFetcher, yahooAssets } from "@/lib/providers/yahooProvider";

export type RegimeCalculationReport = MacroRegimeResult;

export type AlertCheckReport = {
  triggered: number;
  inserted: number;
  alerts: string[];
};

export type FullDataUpdateReport = {
  fred: FetchJobResult;
  yahoo: FetchJobResult;
  regime: RegimeCalculationReport;
  alerts: AlertCheckReport;
};

type Logger = (message: string) => void;

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayUtcDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function todayRange(): { start: Date; end: Date; triggeredAt: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end, triggeredAt: now };
}

function fetchLogWriter(prisma: PrismaClient) {
  return async (data: {
    provider: string;
    symbol: string;
    indicatorId: number;
    status: string;
    errorType?: string | null;
    errorMessage?: string | null;
    observationsInserted: number;
    observationsSkippedDuplicate: number;
    startedAt: Date;
    finishedAt: Date;
  }) => {
    await prisma.dataFetchLog.create({
      data: {
        ...data,
        indicatorId: String(data.indicatorId),
      },
    });
  };
}

export async function runFredDataUpdate(prisma: PrismaClient, log?: Logger): Promise<FetchJobResult> {
  const indicators = await prisma.indicator.findMany({
    where: {
      source: "FRED",
      fredSeriesId: { not: null },
    },
    orderBy: { symbol: "asc" },
  });

  return runFetchJob({
    fetcher: createFredFetcher({
      observationStart: toDateOnly(subYears(new Date(), 10)),
    }),
    indicators,
    observationExists: async (indicatorId, date) => {
      const existing = await prisma.observation.findUnique({
        where: {
          indicatorId_date: {
            indicatorId,
            date,
          },
        },
      });
      return existing !== null;
    },
    insertObservation: async (data) => {
      await prisma.observation.create({ data });
    },
    writeFetchLog: fetchLogWriter(prisma),
    log,
  });
}

export async function runYahooDataUpdate(prisma: PrismaClient, log?: Logger): Promise<FetchJobResult> {
  const indicators = [];
  for (const asset of yahooAssets) {
    const indicator = await prisma.indicator.upsert({
      where: { symbol: asset.symbol },
      update: {
        name: asset.name,
        category: asset.category,
        source: "YAHOO",
        fredSeriesId: null,
        frequency: "daily",
        description: asset.description,
        macroLogic: asset.macroLogic,
      },
      create: {
        name: asset.name,
        symbol: asset.symbol,
        category: asset.category,
        source: "YAHOO",
        fredSeriesId: null,
        frequency: "daily",
        description: asset.description,
        macroLogic: asset.macroLogic,
      },
    });
    indicators.push(indicator);
  }

  return runFetchJob({
    fetcher: createYahooFetcher({
      period1: subYears(new Date(), 10),
      period2: new Date(),
      interval: "1d",
    }),
    indicators,
    observationExists: async (indicatorId, date) => {
      const existing = await prisma.observation.findUnique({
        where: {
          indicatorId_date: {
            indicatorId,
            date,
          },
        },
      });
      return existing !== null;
    },
    insertObservation: async (data) => {
      await prisma.observation.create({ data });
    },
    writeFetchLog: fetchLogWriter(prisma),
    log,
  });
}

export async function runRegimeCalculation(prisma: PrismaClient): Promise<RegimeCalculationReport> {
  const indicators = await prisma.indicator.findMany({
    include: {
      observations: {
        orderBy: { date: "asc" },
      },
    },
    orderBy: [{ category: "asc" }, { symbol: "asc" }],
  });

  const stats = calculateAllIndicatorStats(indicators);
  const regime = calculateMacroRegime(stats);
  const date = todayUtcDate();
  const updatedAt = new Date();

  await prisma.macroRegime.upsert({
    where: { date },
    update: {
      ...regime,
      createdAt: updatedAt,
    },
    create: {
      date,
      ...regime,
      createdAt: updatedAt,
    },
  });

  return regime;
}

export async function runAlertCheck(prisma: PrismaClient): Promise<AlertCheckReport> {
  const indicators = await prisma.indicator.findMany({
    include: {
      observations: {
        orderBy: { date: "desc" },
        take: 420,
      },
    },
  });
  const stats = calculateAllIndicatorStats(indicators);
  const triggeredAlerts = evaluateMacroAlerts(stats);
  const { start, end, triggeredAt } = todayRange();
  const report: AlertCheckReport = {
    triggered: triggeredAlerts.length,
    inserted: 0,
    alerts: [],
  };

  for (const alert of triggeredAlerts) {
    const indicator = await prisma.indicator.findUnique({ where: { symbol: alert.indicatorSymbol } });
    if (!indicator) continue;

    const existing = await prisma.alert.findFirst({
      where: {
        indicatorId: indicator.id,
        message: alert.message,
        triggeredAt: {
          gte: start,
          lt: end,
        },
      },
    });
    if (existing) {
      report.alerts.push(`${alert.name}（今日已存在）`);
      continue;
    }

    await prisma.alert.create({
      data: {
        indicatorId: indicator.id,
        operator: alert.operator,
        threshold: alert.threshold,
        message: alert.message,
        severity: alert.severity,
        isActive: true,
        triggeredAt,
      },
    });
    report.inserted += 1;
    report.alerts.push(alert.name);
  }

  return report;
}

export async function runFullDataUpdate(prisma: PrismaClient, log?: Logger): Promise<FullDataUpdateReport> {
  const fred = await runFredDataUpdate(prisma, log);
  const yahoo = await runYahooDataUpdate(prisma, log);
  const regime = await runRegimeCalculation(prisma);
  const alerts = await runAlertCheck(prisma);

  return {
    fred,
    yahoo,
    regime,
    alerts,
  };
}
