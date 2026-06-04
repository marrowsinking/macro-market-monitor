import type { DataFetchLog, MacroRegime } from "@/generated/prisma/client";
import { calculateAllIndicatorStats, type IndicatorStats } from "@/lib/calculateIndicators";
import { buildDashboardInsights } from "@/lib/dashboardInsights";
import { prisma } from "@/lib/prisma";

type ProviderName = "FRED" | "YAHOO";

type DisplayedRegime = Pick<
  MacroRegime,
  | "liquidityScore"
  | "inflationScore"
  | "growthScore"
  | "riskAppetiteScore"
  | "dollarScore"
  | "creditScore"
  | "commodityScore"
  | "chinaScore"
  | "finalRegime"
  | "summary"
>;

export type ProviderFetchStatus = {
  provider: ProviderName;
  latestSuccessAt: Date | null;
  latestFinishedAt: Date | null;
  latestResult: DataFetchLog | null;
  latestFailure: DataFetchLog | null;
  hasRecentFailure: boolean;
  status: "ok" | "failed" | "unknown";
  message: string | null;
};

export type DashboardFreshnessStatus = {
  status: "NO_REGIME" | "FRESH" | "STALE" | "LAST_KNOWN_GOOD";
  isToday: boolean;
  message: string | null;
};

export type DashboardViewModel = {
  stats: IndicatorStats[];
  regime: MacroRegime | null;
  displayedRegime: DisplayedRegime;
  insights: ReturnType<typeof buildDashboardInsights>;
  latestAlerts: Array<{
    id: number;
    message: string;
    severity: string;
    triggeredAt: Date | null;
    indicator: {
      symbol: string;
    };
  }>;
  chartSource: IndicatorStats | null;
  chartData: Array<{ date: string; value: number }>;
  tableStats: IndicatorStats[];
  fredKeyMissing: boolean;
  latestFredFetchResult: ProviderFetchStatus;
  latestYahooFetchResult: ProviderFetchStatus;
  lastSuccessfulUpdateTime: Date | null;
  dataFreshnessStatus: DashboardFreshnessStatus;
};

const watchedSymbols = ["DGS2", "DGS10", "T10Y2Y", "WALCL", "VIXCLS", "BAMLH0A0HYM2", "DCOILWTICO", "GC=F", "SI=F", "HG=F"];

function isToday(value: Date): boolean {
  const now = new Date();
  return value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth() && value.getDate() === now.getDate();
}

function emptyRegime(): DisplayedRegime {
  return {
    liquidityScore: 0,
    inflationScore: 0,
    growthScore: 0,
    riskAppetiteScore: 0,
    dollarScore: 0,
    creditScore: 0,
    commodityScore: 0,
    chinaScore: 0,
    finalRegime: "尚未生成宏觀狀態",
    summary: "尚未生成宏觀狀態，請先執行 npm run fetch:fred 和 npm run calculate:regime",
  };
}

async function getProviderFetchStatus(provider: ProviderName): Promise<ProviderFetchStatus> {
  const dataFetchLog = (prisma as unknown as {
    dataFetchLog?: {
      findFirst: typeof prisma.dataFetchLog.findFirst;
    };
  }).dataFetchLog;

  if (!dataFetchLog) {
    return {
      provider,
      latestSuccessAt: null,
      latestFinishedAt: null,
      latestResult: null,
      latestFailure: null,
      hasRecentFailure: false,
      status: "unknown",
      message: "尚未建立資料抓取記錄",
    };
  }

  let latestSuccess: DataFetchLog | null = null;
  let latestResult: DataFetchLog | null = null;
  let latestFailure: DataFetchLog | null = null;

  try {
    [latestSuccess, latestResult, latestFailure] = await Promise.all([
      dataFetchLog.findFirst({
        where: { provider, status: "SUCCESS" },
        orderBy: { finishedAt: "desc" },
      }),
      dataFetchLog.findFirst({
        where: { provider },
        orderBy: { finishedAt: "desc" },
      }),
      dataFetchLog.findFirst({
        where: { provider, status: "FAILED" },
        orderBy: { finishedAt: "desc" },
      }),
    ]);
  } catch {
    return {
      provider,
      latestSuccessAt: null,
      latestFinishedAt: null,
      latestResult: null,
      latestFailure: null,
      hasRecentFailure: false,
      status: "unknown",
      message: "尚未建立資料抓取記錄",
    };
  }

  const hasRecentFailure = latestFailure !== null && (latestSuccess === null || latestFailure.finishedAt >= latestSuccess.finishedAt);

  return {
    provider,
    latestSuccessAt: latestSuccess?.finishedAt ?? null,
    latestFinishedAt: latestResult?.finishedAt ?? null,
    latestResult,
    latestFailure,
    hasRecentFailure,
    status: hasRecentFailure ? "failed" : "ok",
    message: null,
  };
}

function buildFreshnessStatus(input: {
  regime: MacroRegime | null;
  fredStatus: ProviderFetchStatus;
  yahooStatus: ProviderFetchStatus;
}): DashboardFreshnessStatus {
  if (!input.regime) {
    return {
      status: "NO_REGIME",
      isToday: false,
      message: "尚未生成宏觀狀態，請先執行 npm run fetch:fred 和 npm run calculate:regime",
    };
  }

  const regimeIsToday = isToday(input.regime.createdAt);
  const latestFailureAt = [input.fredStatus.latestFailure?.finishedAt, input.yahooStatus.latestFailure?.finishedAt]
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  if (latestFailureAt && latestFailureAt > input.regime.createdAt) {
    return {
      status: "LAST_KNOWN_GOOD",
      isToday: regimeIsToday,
      message: "目前顯示的是上次成功生成的宏觀狀態。",
    };
  }

  if (!regimeIsToday) {
    return {
      status: "STALE",
      isToday: false,
      message: "數據可能不是最新，請先執行 npm run update:data",
    };
  }

  return {
    status: "FRESH",
    isToday: true,
    message: null,
  };
}

export async function getDashboardViewModel(): Promise<DashboardViewModel> {
  const [indicators, latestMacroRegime, latestAlerts, fredStatus, yahooStatus] = await Promise.all([
    prisma.indicator.findMany({
      include: {
        observations: {
          orderBy: { date: "desc" },
          take: 420,
        },
      },
      orderBy: [{ category: "asc" }, { symbol: "asc" }],
    }),
    prisma.macroRegime.findFirst({
      orderBy: { date: "desc" },
    }),
    prisma.alert.findMany({
      where: {
        triggeredAt: { not: null },
        severity: { in: ["high", "medium"] },
      },
      include: { indicator: true },
      orderBy: { triggeredAt: "desc" },
      take: 3,
    }),
    getProviderFetchStatus("FRED"),
    getProviderFetchStatus("YAHOO"),
  ]);

  const stats = calculateAllIndicatorStats(indicators);
  const displayedRegime = latestMacroRegime ?? emptyRegime();
  const chartSource = stats.find((item) => item.indicator.symbol === "DGS10") ?? stats.find((item) => item.latestValue !== null) ?? null;
  const chartData =
    chartSource?.indicator.observations
      .slice()
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-180)
      .map((item) => ({ date: item.date.toISOString().slice(0, 10), value: item.value })) ?? [];
  const tableStats = watchedSymbols.map((symbol) => stats.find((item) => item.indicator.symbol === symbol)).filter((item): item is IndicatorStats => item !== undefined);
  const dataFreshnessStatus = buildFreshnessStatus({
    regime: latestMacroRegime,
    fredStatus,
    yahooStatus,
  });

  return {
    stats,
    regime: latestMacroRegime,
    displayedRegime,
    insights: buildDashboardInsights(displayedRegime, stats),
    latestAlerts,
    chartSource,
    chartData,
    tableStats,
    fredKeyMissing: !process.env.FRED_API_KEY?.trim(),
    latestFredFetchResult: fredStatus,
    latestYahooFetchResult: yahooStatus,
    lastSuccessfulUpdateTime: latestMacroRegime?.createdAt ?? null,
    dataFreshnessStatus,
  };
}
