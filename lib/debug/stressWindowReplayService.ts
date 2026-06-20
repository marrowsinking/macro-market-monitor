import { macroScoreKeys } from "@/lib/config/macroEngineConfig";
import type { MacroScoreKey } from "@/lib/config/macroEngineConfig.types";
import {
  buildHistoricalReplayResult,
  type HistoricalReplayResult,
  type HistoricalReplayScoreSummary,
  type HistoricalReplayStability,
} from "@/lib/debug/historicalReplayService";
import type { ObservationSeriesMap } from "@/lib/engines/shadowScoreEngine";

export type StressWindowStatus = "ok" | "partial" | "failed";
export type StressWindowVerdict = "pass_like" | "watch" | "concern" | "unavailable";
export type StressWindowInterpretation = "supportive" | "warning" | "conflicting" | "neutral" | "unavailable";

export const STRESS_WINDOWS = [
  {
    id: "covid_liquidity_shock_2020",
    label: "2020 COVID Liquidity Shock",
    startDate: "2020-02-15",
    endDate: "2020-04-30",
    expectedFocus: [
      "liquidity_score",
      "credit_score",
      "risk_appetite_score",
      "dollar_score",
    ],
    description:
      "Liquidity shock, credit stress, risk appetite breakdown, and dollar funding pressure.",
  },
  {
    id: "inflation_fed_hiking_2022",
    label: "2022 Inflation / Fed Hiking Shock",
    startDate: "2022-01-01",
    endDate: "2022-10-31",
    expectedFocus: [
      "inflation_score",
      "dollar_score",
      "risk_appetite_score",
      "credit_score",
    ],
    description:
      "High inflation, aggressive Fed hiking, stronger dollar pressure, and risk asset weakness.",
  },
  {
    id: "banking_stress_2023",
    label: "2023 Banking Stress",
    startDate: "2023-03-01",
    endDate: "2023-04-30",
    expectedFocus: [
      "credit_score",
      "liquidity_score",
      "risk_appetite_score",
      "dollar_score",
    ],
    description:
      "Banking-sector stress period where credit and liquidity signals should be carefully reviewed.",
  },
  {
    id: "recent_high_rate_risk_on",
    label: "Recent High-rate Risk-on",
    dynamicDays: 180,
    expectedFocus: [
      "risk_appetite_score",
      "credit_score",
      "dollar_score",
      "liquidity_score",
    ],
    description:
      "Recent period where risk appetite may remain positive despite high rates and mixed liquidity.",
  },
] as const;

type StressWindowDefinition = (typeof STRESS_WINDOWS)[number];

export interface ResolvedStressWindow {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  expectedFocus: MacroScoreKey[];
  description: string;
}

export interface StressWindowReplayResult {
  generatedAt: string;
  engineVersion: string;
  params: {
    window: string;
    step: number;
  };
  summary: {
    totalWindows: number;
    okWindows: number;
    partialWindows: number;
    failedWindows: number;
    passLikeCount: number;
    watchCount: number;
    concernCount: number;
  };
  windows: StressWindowReplayWindowResult[];
  globalNotes: string[];
}

export interface StressWindowReplayWindowResult {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  status: StressWindowStatus;
  verdict: StressWindowVerdict;
  description: string;
  expectedFocus: string[];
  replaySummary: {
    replayDates: number;
    successfulDates: number;
    partialDates: number;
    failedDates: number;
  };
  scoreSummaries: StressWindowScoreSummary[];
  notes: string[];
}

export interface StressWindowScoreSummary {
  scoreKey: string;
  label: string;
  focus: boolean;
  stability: HistoricalReplayStability;
  availableCount: number;
  missingCount: number;
  average: number | null;
  min: number | null;
  max: number | null;
  latest: number | null;
  signFlipCount: number;
  largeMoveCount: number;
  saturationCount: number;
  interpretation: StressWindowInterpretation;
  notes: string[];
}

type RunReplay = (params: {
  windowId: string;
  startDate: string;
  endDate: string;
  step: number;
  observationsBySymbol: ObservationSeriesMap;
}) => HistoricalReplayResult | Promise<HistoricalReplayResult>;

const DAY_MS = 24 * 60 * 60 * 1000;

const scoreLabels: Record<MacroScoreKey, string> = {
  liquidity_score: "流動性",
  inflation_score: "通脹壓力",
  growth_score: "增長",
  risk_appetite_score: "風險偏好",
  dollar_score: "美元壓力",
  credit_score: "信用環境",
  commodity_score: "商品週期",
  china_score: "中國宏觀",
};

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function isMacroScoreKey(value: string): value is MacroScoreKey {
  return (macroScoreKeys as readonly string[]).includes(value);
}

function normalizeFocus(values: readonly string[]): MacroScoreKey[] {
  return values.filter(isMacroScoreKey);
}

export function clampStressWindowStep(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 5;
  return Math.min(10, Math.max(1, Math.trunc(value)));
}

function resolveWindowDates(window: StressWindowDefinition, today: Date): ResolvedStressWindow {
  if ("dynamicDays" in window) {
    const endDate = dateKey(today);
    const startDate = dateKey(addDays(today, -window.dynamicDays));
    return {
      id: window.id,
      label: window.label,
      startDate,
      endDate,
      expectedFocus: normalizeFocus(window.expectedFocus),
      description: window.description,
    };
  }

  return {
    id: window.id,
    label: window.label,
    startDate: window.startDate,
    endDate: window.endDate,
    expectedFocus: normalizeFocus(window.expectedFocus),
    description: window.description,
  };
}

export function resolveStressWindows(params: {
  requestedWindow?: string | null;
  today?: Date;
}): { windows: ResolvedStressWindow[]; notes: string[]; resolvedWindowParam: string } {
  const requestedWindow = params.requestedWindow || "all";
  const today = params.today ?? new Date();
  const notes: string[] = [];
  const allWindows = STRESS_WINDOWS.map((window) => resolveWindowDates(window, today));

  if (requestedWindow === "all") {
    return { windows: allWindows, notes, resolvedWindowParam: "all" };
  }

  const selected = allWindows.find((window) => window.id === requestedWindow);
  if (!selected) {
    notes.push(`Invalid stress window "${requestedWindow}". Returning all predefined windows.`);
    return { windows: allWindows, notes, resolvedWindowParam: "all" };
  }

  return { windows: [selected], notes, resolvedWindowParam: requestedWindow };
}

function interpretScore(summary: HistoricalReplayScoreSummary, focus: boolean): StressWindowInterpretation {
  if (summary.stability === "unavailable" || summary.availableCount === 0) return "unavailable";
  if (summary.stability === "unstable") return "warning";
  if (focus) return "supportive";
  return "neutral";
}

function convertScoreSummary(
  summary: HistoricalReplayScoreSummary,
  focusScores: Set<MacroScoreKey>,
): StressWindowScoreSummary {
  const focus = focusScores.has(summary.scoreKey);
  return {
    scoreKey: summary.scoreKey,
    label: summary.label || scoreLabels[summary.scoreKey],
    focus,
    stability: summary.stability,
    availableCount: summary.availableCount,
    missingCount: summary.missingCount,
    average: summary.average,
    min: summary.min,
    max: summary.max,
    latest: summary.latest,
    signFlipCount: summary.signFlipCount,
    largeMoveCount: summary.largeMoveCount,
    saturationCount: summary.saturationCount,
    interpretation: interpretScore(summary, focus),
    notes: summary.notes,
  };
}

function unavailableScoreSummary(scoreKey: MacroScoreKey, focusScores: Set<MacroScoreKey>, note: string): StressWindowScoreSummary {
  const focus = focusScores.has(scoreKey);
  return {
    scoreKey,
    label: scoreLabels[scoreKey],
    focus,
    stability: "unavailable",
    availableCount: 0,
    missingCount: 0,
    average: null,
    min: null,
    max: null,
    latest: null,
    signFlipCount: 0,
    largeMoveCount: 0,
    saturationCount: 0,
    interpretation: "unavailable",
    notes: [note],
  };
}

function verdictForWindow(status: StressWindowStatus, summaries: StressWindowScoreSummary[]): StressWindowVerdict {
  if (status === "failed") return "unavailable";
  const focusSummaries = summaries.filter((summary) => summary.focus);
  if (focusSummaries.length === 0) return "unavailable";

  const unavailableCount = focusSummaries.filter((summary) => summary.interpretation === "unavailable").length;
  const unstableCount = focusSummaries.filter((summary) => summary.stability === "unstable").length;

  if (unavailableCount > focusSummaries.length / 2) return "unavailable";
  if (unstableCount >= 2) return "concern";
  if (unstableCount >= 1 || unavailableCount >= 1) return "watch";
  return "pass_like";
}

function statusFromReplay(result: HistoricalReplayResult): StressWindowStatus {
  if (result.summary.failedDates === result.summary.replayDates && result.summary.replayDates > 0) return "failed";
  if (result.summary.partialDates > 0 || result.summary.failedDates > 0) return "partial";
  return "ok";
}

function defaultRunReplay(params: {
  startDate: string;
  endDate: string;
  step: number;
  observationsBySymbol: ObservationSeriesMap;
}): HistoricalReplayResult {
  return buildHistoricalReplayResult({
    observationsBySymbol: params.observationsBySymbol,
    params: {
      startDate: params.startDate,
      endDate: params.endDate,
      step: params.step,
    },
  });
}

async function buildWindowResult(params: {
  window: ResolvedStressWindow;
  step: number;
  observationsBySymbol: ObservationSeriesMap;
  runReplay: RunReplay;
}): Promise<StressWindowReplayWindowResult> {
  const replay = await params.runReplay({
    windowId: params.window.id,
    startDate: params.window.startDate,
    endDate: params.window.endDate,
    step: params.step,
    observationsBySymbol: params.observationsBySymbol,
  });
  const focusScores = new Set(params.window.expectedFocus);
  const summariesByScore = new Map(replay.summary.scoreSummaries.map((summary) => [summary.scoreKey, summary]));
  const scoreSummaries = macroScoreKeys.map((scoreKey) => {
    const summary = summariesByScore.get(scoreKey);
    return summary
      ? convertScoreSummary(summary, focusScores)
      : unavailableScoreSummary(scoreKey, focusScores, "Replay did not return this score summary.");
  });
  const status = statusFromReplay(replay);

  return {
    id: params.window.id,
    label: params.window.label,
    startDate: params.window.startDate,
    endDate: params.window.endDate,
    status,
    verdict: verdictForWindow(status, scoreSummaries),
    description: params.window.description,
    expectedFocus: params.window.expectedFocus,
    replaySummary: {
      replayDates: replay.summary.replayDates,
      successfulDates: replay.summary.successfulDates,
      partialDates: replay.summary.partialDates,
      failedDates: replay.summary.failedDates,
    },
    scoreSummaries,
    notes: replay.globalNotes,
  };
}

function failedWindowResult(window: ResolvedStressWindow, message: string): StressWindowReplayWindowResult {
  const focusScores = new Set(window.expectedFocus);
  const scoreSummaries = macroScoreKeys.map((scoreKey) => unavailableScoreSummary(scoreKey, focusScores, message));

  return {
    id: window.id,
    label: window.label,
    startDate: window.startDate,
    endDate: window.endDate,
    status: "failed",
    verdict: "unavailable",
    description: window.description,
    expectedFocus: window.expectedFocus,
    replaySummary: {
      replayDates: 0,
      successfulDates: 0,
      partialDates: 0,
      failedDates: 0,
    },
    scoreSummaries,
    notes: [message],
  };
}

export async function buildStressWindowReplayResult(params: {
  observationsBySymbol: ObservationSeriesMap;
  requestedWindow?: string | null;
  step?: number | null;
  today?: Date;
  generatedAt?: Date;
  runReplay?: RunReplay;
}): Promise<StressWindowReplayResult> {
  const step = clampStressWindowStep(params.step);
  const resolved = resolveStressWindows({
    requestedWindow: params.requestedWindow,
    today: params.today,
  });
  const globalNotes = [
    ...resolved.notes,
    "Debug-only stress-window replay uses v2 shadow scores and does not affect official dashboard, regimes, alerts, or persisted data.",
  ];
  const runReplay = params.runReplay ?? defaultRunReplay;
  const windows: StressWindowReplayWindowResult[] = [];

  for (const window of resolved.windows) {
    try {
      windows.push(
        await buildWindowResult({
          window,
          step,
          observationsBySymbol: params.observationsBySymbol,
          runReplay,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stress window replay failed.";
      globalNotes.push(`${window.id}: ${message}`);
      windows.push(failedWindowResult(window, message));
    }
  }

  return {
    generatedAt: (params.generatedAt ?? new Date()).toISOString(),
    engineVersion: "stress-window-replay-debug",
    params: {
      window: resolved.resolvedWindowParam,
      step,
    },
    summary: {
      totalWindows: windows.length,
      okWindows: windows.filter((window) => window.status === "ok").length,
      partialWindows: windows.filter((window) => window.status === "partial").length,
      failedWindows: windows.filter((window) => window.status === "failed").length,
      passLikeCount: windows.filter((window) => window.verdict === "pass_like").length,
      watchCount: windows.filter((window) => window.verdict === "watch").length,
      concernCount: windows.filter((window) => window.verdict === "concern").length,
    },
    windows,
    globalNotes,
  };
}
