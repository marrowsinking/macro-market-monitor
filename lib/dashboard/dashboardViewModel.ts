import type { DataFetchLog, MacroRegime } from "@/generated/prisma/client";
import { calculateAllIndicatorStats, type IndicatorStats } from "@/lib/calculateIndicators";
import { buildDashboardInsights } from "@/lib/dashboardInsights";
import { generateResearchNarrative, type ResearchNarrative } from "@/lib/dashboard/researchNarrative";
import { calculateConfirmedRegime, type ConfirmedRegimeResult } from "@/lib/engines/confirmedRegimeEngine";
import { isIndicatorActive } from "@/lib/indicators/indicatorVisibility";
import { prisma } from "@/lib/prisma";
import { getScoreBreakdowns, type ScoreBreakdown } from "@/lib/scores/scoreBreakdown";

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

type ScoreKey =
  | "liquidityScore"
  | "inflationScore"
  | "growthScore"
  | "riskAppetiteScore"
  | "dollarScore"
  | "creditScore"
  | "commodityScore"
  | "chinaScore";

export type ScoreChange = {
  previous: number | null;
  current: number;
  change: number | null;
};

export type ScoreChanges = Record<ScoreKey, ScoreChange>;

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

export type DashboardDataStatusProvider = {
  name: ProviderName;
  status: "normal" | "partial" | "failed" | "unknown";
  indicatorsWithDataCount: number;
  indicatorCount: number;
  latestSuccessAt: string | null;
  latestFailureAt: string | null;
  symbol?: string | null;
  errorType?: string | null;
  errorMessage?: string | null;
};

export type DashboardDataStatus = {
  lastUpdatedAt: string | null;
  lastUpdatedAtEastern: string | null;
  lastSuccessfulRegimeAt: string | null;
  isUsingFallback: boolean;
  indicatorCount: number;
  indicatorsWithDataCount: number;
  activeIndicatorCount: number;
  activeIndicatorsWithDataCount: number;
  chartBenchmarkName: string | null;
  providers: DashboardDataStatusProvider[];
  message: string | null;
  hasAbnormalStatus: boolean;
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
  dataStatus: DashboardDataStatus;
  confirmedRegimeState: ConfirmedRegimeResult;
  scoreChanges: ScoreChanges;
  researchNarrative: ResearchNarrative;
  scoreBreakdowns: ScoreBreakdown[];
};

const watchedSymbols = ["DGS2", "DGS10", "T10Y2Y", "WALCL", "VIXCLS", "BAMLH0A0HYM2", "DCOILWTICO", "GC=F", "SI=F", "HG=F"];

function isToday(value: Date): boolean {
  const now = new Date();
  return value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth() && value.getDate() === now.getDate();
}

function formatDateTime(value: Date | null): string | null {
  if (!value) return null;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function formatEasternDateTime(value: Date | null): string | null {
  if (!value) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
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

const scoreKeys: ScoreKey[] = [
  "liquidityScore",
  "inflationScore",
  "growthScore",
  "riskAppetiteScore",
  "dollarScore",
  "creditScore",
  "commodityScore",
  "chinaScore",
];

export function getScoreChanges(current: DisplayedRegime, previous: DisplayedRegime | null): ScoreChanges {
  return Object.fromEntries(
    scoreKeys.map((key) => {
      const previousValue = previous?.[key] ?? null;
      const currentValue = current[key];
      return [
        key,
        {
          previous: previousValue,
          current: currentValue,
          change: previousValue === null ? null : Number((currentValue - previousValue).toFixed(2)),
        },
      ];
    }),
  ) as ScoreChanges;
}

export function getActiveIndicatorCoverage(stats: IndicatorStats[]) {
  const activeStats = stats.filter((item) => isIndicatorActive(item.indicator));
  return {
    activeIndicatorCount: activeStats.length,
    activeIndicatorsWithDataCount: activeStats.filter((item) => item.latestValue !== null).length,
  };
}

function providerIndicatorCoverage(stats: IndicatorStats[], provider: ProviderName) {
  const providerStats = stats.filter((item) => item.indicator.source === provider && isIndicatorActive(item.indicator));
  return {
    indicatorCount: providerStats.length,
    indicatorsWithDataCount: providerStats.filter((item) => item.latestValue !== null).length,
  };
}

function providerStatus(status: ProviderFetchStatus, coverage: { indicatorsWithDataCount: number; indicatorCount: number }): DashboardDataStatusProvider {
  if (status.status === "unknown") {
    return {
      name: status.provider,
      status: "unknown",
      ...coverage,
      latestSuccessAt: null,
      latestFailureAt: null,
      symbol: null,
      errorType: null,
      errorMessage: status.message,
    };
  }

  const latestFailureAt = status.latestFailure?.finishedAt ?? null;
  let displayStatus: DashboardDataStatusProvider["status"] = "normal";
  if (status.hasRecentFailure && status.latestSuccessAt) displayStatus = "partial";
  if (status.hasRecentFailure && !status.latestSuccessAt) displayStatus = "failed";

  return {
    name: status.provider,
    status: displayStatus,
    ...coverage,
    latestSuccessAt: formatDateTime(status.latestSuccessAt),
    latestFailureAt: formatDateTime(latestFailureAt),
    symbol: status.hasRecentFailure ? status.latestFailure?.symbol ?? null : null,
    errorType: status.hasRecentFailure ? status.latestFailure?.errorType ?? "UNKNOWN" : null,
    errorMessage: status.hasRecentFailure ? status.latestFailure?.errorMessage ?? "暫無錯誤訊息" : null,
  };
}

type RegimeStateRecord = {
  confirmedRegime: string;
  rawRegimeSignal: string;
  pendingRegime: string | null;
  pendingConfirmationDays: number;
  requiredConfirmationDays: number;
  daysInConfirmedRegime: number;
  confidence: string;
  explanation: string | null;
};

type RegimeStateDelegate = {
  findFirst: (args: { orderBy: Record<string, "asc" | "desc"> }) => Promise<RegimeStateRecord | null>;
  findMany: (args: { orderBy: Record<string, "asc" | "desc">; take: number }) => Promise<RegimeStateRecord[]>;
};

function resultFromRegimeState(record: RegimeStateRecord, previousConfirmedRegime: string | null): ConfirmedRegimeResult {
  return {
    confirmedRegime: record.confirmedRegime,
    rawRegimeSignal: record.rawRegimeSignal,
    previousConfirmedRegime,
    regimeChanged: previousConfirmedRegime !== null && previousConfirmedRegime !== record.confirmedRegime,
    pendingRegime: record.pendingRegime,
    pendingConfirmationDays: record.pendingConfirmationDays,
    requiredConfirmationDays: record.requiredConfirmationDays,
    daysInConfirmedRegime: record.daysInConfirmedRegime,
    confidence: record.confidence === "high" || record.confidence === "medium" || record.confidence === "low" ? record.confidence : "low",
    explanation: record.explanation ?? "",
  };
}

export function getInitialConfirmedRegimeState(rawRegimeSignal: string): ConfirmedRegimeResult {
  return calculateConfirmedRegime({
    latestRawRegimeSignal: rawRegimeSignal,
    previousRegimeState: null,
  });
}

async function getLatestConfirmedRegimeState(latestRawRegimeSignal: string): Promise<ConfirmedRegimeResult> {
  const delegate = (prisma as unknown as { regimeState?: RegimeStateDelegate }).regimeState;
  if (!delegate) {
    return getInitialConfirmedRegimeState(latestRawRegimeSignal);
  }

  try {
    const latest = await delegate.findFirst({ orderBy: { date: "desc" } });
    if (!latest) {
      return getInitialConfirmedRegimeState(latestRawRegimeSignal);
    }
    const states = await delegate.findMany({ orderBy: { date: "desc" }, take: 2 });
    const previous = states[1] ?? null;
    return resultFromRegimeState(latest, previous?.confirmedRegime ?? null);
  } catch {
    return getInitialConfirmedRegimeState(latestRawRegimeSignal);
  }
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
  const [indicators, macroRegimes, latestAlerts, fredStatus, yahooStatus] = await Promise.all([
    prisma.indicator.findMany({
      include: {
        observations: {
          orderBy: { date: "desc" },
          take: 420,
        },
      },
      orderBy: [{ category: "asc" }, { symbol: "asc" }],
    }),
    prisma.macroRegime.findMany({
      orderBy: { date: "desc" },
      take: 2,
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

  const latestMacroRegime = macroRegimes[0] ?? null;
  const previousMacroRegime = macroRegimes[1] ?? null;
  const stats = calculateAllIndicatorStats(indicators);
  const activeCoverage = getActiveIndicatorCoverage(stats);
  const displayedRegime = latestMacroRegime ?? emptyRegime();
  const confirmedRegimeState = await getLatestConfirmedRegimeState(displayedRegime.finalRegime);
  const scoreChanges = getScoreChanges(displayedRegime, previousMacroRegime);
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
  const providers = [
    providerStatus(fredStatus, providerIndicatorCoverage(stats, "FRED")),
    providerStatus(yahooStatus, providerIndicatorCoverage(stats, "YAHOO")),
  ];
  const dataStatus: DashboardDataStatus = {
    lastUpdatedAt: formatDateTime(latestMacroRegime?.createdAt ?? null),
    lastUpdatedAtEastern: formatEasternDateTime(latestMacroRegime?.createdAt ?? null),
    lastSuccessfulRegimeAt: formatDateTime(latestMacroRegime?.createdAt ?? null),
    isUsingFallback: dataFreshnessStatus.status === "LAST_KNOWN_GOOD",
    indicatorCount: stats.length,
    indicatorsWithDataCount: stats.filter((item) => item.latestValue !== null).length,
    activeIndicatorCount: activeCoverage.activeIndicatorCount,
    activeIndicatorsWithDataCount: activeCoverage.activeIndicatorsWithDataCount,
    chartBenchmarkName: chartSource?.indicator.name ?? null,
    providers,
    message: dataFreshnessStatus.message,
    hasAbnormalStatus: dataFreshnessStatus.status !== "FRESH" || providers.some((item) => item.status !== "normal"),
  };
  const insights = buildDashboardInsights(displayedRegime, stats);
  const researchNarrative = generateResearchNarrative({
    latestRegime: latestMacroRegime ? { ...latestMacroRegime, finalRegime: confirmedRegimeState.confirmedRegime } : null,
    previousRegime: previousMacroRegime ? { ...previousMacroRegime, finalRegime: confirmedRegimeState.previousConfirmedRegime ?? confirmedRegimeState.confirmedRegime } : null,
    confirmedRegimeState,
    scoreChanges,
    keyDrivers: insights.keyDrivers,
    conflictingSignals: insights.conflictingSignals,
    watchNext: insights.watchNext,
    regimeHistorySummary: previousMacroRegime ? null : "暫無上一筆 MacroRegime，先以今日狀態作為觀察基準。",
  });
  const scoreBreakdowns = getScoreBreakdowns({
    stats,
    scores: displayedRegime,
  });

  return {
    stats,
    regime: latestMacroRegime,
    displayedRegime,
    insights,
    latestAlerts,
    chartSource,
    chartData,
    tableStats,
    fredKeyMissing: !process.env.FRED_API_KEY?.trim(),
    latestFredFetchResult: fredStatus,
    latestYahooFetchResult: yahooStatus,
    lastSuccessfulUpdateTime: latestMacroRegime?.createdAt ?? null,
    dataFreshnessStatus,
    dataStatus,
    confirmedRegimeState,
    scoreChanges,
    researchNarrative,
    scoreBreakdowns,
  };
}
