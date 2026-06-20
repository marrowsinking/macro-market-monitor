import {
  getMacroScoreConfig,
  macroScoreKeys,
} from "@/lib/config/macroEngineConfig";
import type {
  MacroFactorConfig,
  MacroScoreKey,
} from "@/lib/config/macroEngineConfig.types";
import {
  buildHistoricalReplayResult,
  DEFAULT_REPLAY_LOOKBACK_DAYS,
  type HistoricalReplayResult,
  type HistoricalReplayScoreSummary,
  type HistoricalReplayStability,
} from "@/lib/debug/historicalReplayService";
import {
  calculateShadowFactorContribution,
  type ObservationSeriesMap,
  type ShadowContributionStatus,
} from "@/lib/engines/shadowScoreEngine";
import type { RawObservationPoint } from "@/lib/engines/normalizationEngine";

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
  partialReasons: StressWindowPartialReasons;
  scoreSummaries: StressWindowScoreSummary[];
  notes: string[];
}

export interface StressWindowPartialReasons {
  focusUnavailableScores: string[];
  nonFocusUnavailableScores: string[];
  focusUnstableScores: string[];
  nonFocusUnstableScores: string[];
  expectedUnavailableScores: string[];
  missingScoreCount: number;
  focusMissingCount: number;
  nonFocusMissingCount: number;
  affectsPromotionReadiness: boolean;
  summary: string;
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
  availabilityDiagnostics?: StressWindowAvailabilityDiagnostics;
  notes: string[];
}

export interface StressWindowAvailabilityDiagnostics {
  unavailableReason:
    | "none"
    | "missing_observations"
    | "insufficient_observations"
    | "insufficient_lookback"
    | "calculation_error"
    | "not_scored"
    | "unknown";
  affectedFactors: StressWindowAffectedFactorDiagnostic[];
  replayAvailableCount: number;
  replayMissingCount: number;
  firstAvailableReplayDate?: string | null;
  lastAvailableReplayDate?: string | null;
  note: string;
}

export interface StressWindowAffectedFactorDiagnostic {
  symbol: string;
  status:
    | "ok"
    | "missing"
    | "insufficient"
    | "insufficient_lookback"
    | "not_scored"
    | "context_dependent"
    | "error";
  observationCount: number;
  firstDate?: string | null;
  latestDate?: string | null;
  requiredMinObservations?: number | null;
  requiredLookbackDays?: number | null;
  note: string;
}

type RunReplay = (params: {
  windowId: string;
  startDate: string;
  endDate: string;
  step: number;
  observationsBySymbol: ObservationSeriesMap;
}) => HistoricalReplayResult | Promise<HistoricalReplayResult>;

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPECTED_UNAVAILABLE_SCORES = new Set<MacroScoreKey>(["china_score"]);

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

function pointDateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
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
  diagnostics?: StressWindowAvailabilityDiagnostics,
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
    availabilityDiagnostics: diagnostics,
    notes: summary.notes,
  };
}

function unavailableScoreSummary(
  scoreKey: MacroScoreKey,
  focusScores: Set<MacroScoreKey>,
  note: string,
  diagnostics?: StressWindowAvailabilityDiagnostics,
): StressWindowScoreSummary {
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
    availabilityDiagnostics: diagnostics,
    notes: [note],
  };
}

function isUnavailable(summary: StressWindowScoreSummary): boolean {
  return summary.stability === "unavailable" || summary.availableCount === 0 || summary.interpretation === "unavailable";
}

function buildPartialReasons(status: StressWindowStatus, summaries: StressWindowScoreSummary[]): StressWindowPartialReasons {
  const unavailable = summaries.filter(isUnavailable);
  const focusUnavailableScores = unavailable.filter((summary) => summary.focus).map((summary) => summary.scoreKey);
  const nonFocusUnavailableScores = unavailable.filter((summary) => !summary.focus).map((summary) => summary.scoreKey);
  const focusUnstableScores = summaries
    .filter((summary) => summary.focus && summary.stability === "unstable")
    .map((summary) => summary.scoreKey);
  const nonFocusUnstableScores = summaries
    .filter((summary) => !summary.focus && summary.stability === "unstable")
    .map((summary) => summary.scoreKey);
  const expectedUnavailableScores = unavailable
    .filter((summary) => EXPECTED_UNAVAILABLE_SCORES.has(summary.scoreKey as MacroScoreKey))
    .map((summary) => summary.scoreKey);
  const affectsPromotionReadiness = focusUnavailableScores.length > 0 || focusUnstableScores.length > 0;
  const missingScoreCount = unavailable.length;
  const focusMissingCount = focusUnavailableScores.length;
  const nonFocusMissingCount = nonFocusUnavailableScores.length;

  let summary = "All focus scores are available for this stress window.";
  if (focusUnavailableScores.length > 0) {
    const focusUnavailableReasons = summaries
      .filter((item) => item.focus && focusUnavailableScores.includes(item.scoreKey))
      .map((item) => item.availabilityDiagnostics?.unavailableReason)
      .filter(Boolean);
    summary = "Partial status affects promotion readiness because one or more focus scores are unavailable.";
    if (focusUnavailableReasons.includes("insufficient_lookback")) {
      summary += " Focus score availability may improve with a longer replay lookback buffer.";
    } else if (focusUnavailableReasons.includes("missing_observations")) {
      summary += " Focus score unavailable because of missing historical data.";
    } else if (focusUnavailableReasons.includes("insufficient_observations")) {
      summary += " Focus score unavailable because of insufficient historical observations.";
    }
  } else if (focusUnstableScores.length > 0) {
    summary = "Focus score instability requires review before promotion.";
  } else if (
    status === "partial" &&
    expectedUnavailableScores.length > 0 &&
    expectedUnavailableScores.length === missingScoreCount
  ) {
    summary = "Partial status is mainly caused by china_score, which is currently expected to be unavailable.";
  } else if (status === "partial" && nonFocusUnavailableScores.length > 0) {
    summary = "Partial status is caused by non-focus unavailable scores and does not directly block the selected stress-window focus.";
  } else if (nonFocusUnstableScores.length > 0) {
    summary = "Non-focus score instability is visible in this window but does not directly block the selected stress-window focus.";
  }

  return {
    focusUnavailableScores,
    nonFocusUnavailableScores,
    focusUnstableScores,
    nonFocusUnstableScores,
    expectedUnavailableScores,
    missingScoreCount,
    focusMissingCount,
    nonFocusMissingCount,
    affectsPromotionReadiness,
    summary,
  };
}

function requiredLookbackDays(factor: MacroFactorConfig): number | null {
  const preferredWindow = factor.preferredZScoreWindows[0] ?? null;
  const transformLookback = factor.transformLookbackDays ?? 0;
  if (preferredWindow === null && transformLookback === 0) return null;
  return Math.max(preferredWindow ?? 0, transformLookback);
}

function scopedObservations(params: {
  observations: RawObservationPoint[] | undefined;
  startDate?: string | null;
  endDate: string;
}): RawObservationPoint[] {
  return (params.observations ?? []).filter((point) => {
    const key = pointDateKey(point.date);
    return key <= params.endDate && (!params.startDate || key >= params.startDate);
  });
}

function observationDateBounds(observations: RawObservationPoint[]): { firstDate: string | null; latestDate: string | null } {
  if (observations.length === 0) return { firstDate: null, latestDate: null };
  const dates = observations.map((point) => pointDateKey(point.date)).sort();
  return { firstDate: dates[0], latestDate: dates[dates.length - 1] };
}

function mapFactorStatus(params: {
  contributionStatus: ShadowContributionStatus;
  allObservationsBeforeEnd: RawObservationPoint[];
  scoped: RawObservationPoint[];
  dataStartDate: string;
  factor: MacroFactorConfig;
}): StressWindowAffectedFactorDiagnostic["status"] {
  if (params.contributionStatus === "ok") return "ok";
  if (params.contributionStatus === "not_scored") return "not_scored";
  if (params.contributionStatus === "context_dependent") return "context_dependent";
  if (params.contributionStatus === "missing_observations") {
    return params.allObservationsBeforeEnd.length > 0 && params.scoped.length === 0 ? "insufficient_lookback" : "missing";
  }
  if (params.contributionStatus === "insufficient_data") {
    const hasOlderExcludedData = params.allObservationsBeforeEnd.some((point) => pointDateKey(point.date) < params.dataStartDate);
    return hasOlderExcludedData ? "insufficient_lookback" : "insufficient";
  }
  return "error";
}

function factorNote(status: StressWindowAffectedFactorDiagnostic["status"], contributionMessage?: string): string {
  if (status === "ok") return "Factor has enough observations for this replay date.";
  if (status === "missing") return "No observations were found for this factor before the stress window end date.";
  if (status === "insufficient_lookback") return "Historical observations exist, but the replay lookback buffer did not include enough usable data.";
  if (status === "insufficient") return contributionMessage ?? "Observations exist, but there are not enough usable points for normalization.";
  if (status === "not_scored") return "Factor is configured as not scored.";
  if (status === "context_dependent") return "Factor is context-dependent and not directly scored.";
  return contributionMessage ?? "Factor calculation returned an error or unsupported status.";
}

function buildFactorDiagnostic(params: {
  scoreKey: MacroScoreKey;
  groupKey: string;
  factor: MacroFactorConfig;
  observationsBySymbol: ObservationSeriesMap;
  dataStartDate: string;
  endDate: string;
}): StressWindowAffectedFactorDiagnostic {
  const allObservationsBeforeEnd = scopedObservations({
    observations: params.observationsBySymbol[params.factor.symbol],
    endDate: params.endDate,
  });
  const scoped = scopedObservations({
    observations: params.observationsBySymbol[params.factor.symbol],
    startDate: params.dataStartDate,
    endDate: params.endDate,
  });
  const contribution = calculateShadowFactorContribution({
    scoreKey: params.scoreKey,
    groupKey: params.groupKey,
    factor: params.factor,
    observations: scoped,
  });
  const status = mapFactorStatus({
    contributionStatus: contribution.status,
    allObservationsBeforeEnd,
    scoped,
    dataStartDate: params.dataStartDate,
    factor: params.factor,
  });
  const bounds = observationDateBounds(scoped);

  return {
    symbol: params.factor.symbol,
    status,
    observationCount: scoped.length,
    firstDate: bounds.firstDate,
    latestDate: bounds.latestDate,
    requiredMinObservations: params.factor.minObservations,
    requiredLookbackDays: requiredLookbackDays(params.factor),
    note: factorNote(status, contribution.message),
  };
}

function summarizeUnavailableReason(
  scoreKey: MacroScoreKey,
  summary: HistoricalReplayScoreSummary,
  factors: StressWindowAffectedFactorDiagnostic[],
): StressWindowAvailabilityDiagnostics["unavailableReason"] {
  if (scoreKey === "china_score") return "not_scored";
  if (summary.stability !== "unavailable" && summary.availableCount > 0) return "none";
  if (factors.length === 0) return "unknown";
  if (factors.every((factor) => factor.status === "not_scored")) return "not_scored";
  if (factors.some((factor) => factor.status === "insufficient_lookback")) return "insufficient_lookback";
  if (factors.some((factor) => factor.status === "insufficient")) return "insufficient_observations";
  if (factors.every((factor) => factor.status === "missing")) return "missing_observations";
  if (factors.some((factor) => factor.status === "error")) return "calculation_error";
  return "unknown";
}

function availabilityNote(reason: StressWindowAvailabilityDiagnostics["unavailableReason"]): string {
  if (reason === "none") return "Score was available during the replay window.";
  if (reason === "missing_observations") return "Score is unavailable because required factor observations are missing.";
  if (reason === "insufficient_lookback") return "Score may be unavailable because the replay lookback buffer lacks enough older observations.";
  if (reason === "insufficient_observations") return "Score is unavailable because available observations are insufficient for normalization.";
  if (reason === "calculation_error") return "Score is unavailable because one or more factors returned a calculation error.";
  if (reason === "not_scored") return "Score is configured as not scored or placeholder.";
  return "Score availability reason is unknown.";
}

function buildAvailabilityDiagnostics(params: {
  scoreKey: MacroScoreKey;
  summary: HistoricalReplayScoreSummary;
  replay: HistoricalReplayResult;
  window: ResolvedStressWindow;
  observationsBySymbol: ObservationSeriesMap;
  dataStartDate: string;
}): StressWindowAvailabilityDiagnostics {
  const config = getMacroScoreConfig(params.scoreKey);
  const affectedFactors = config.factorGroups.flatMap((group) =>
    group.factors.map((factor) =>
      buildFactorDiagnostic({
        scoreKey: params.scoreKey,
        groupKey: group.key,
        factor,
        observationsBySymbol: params.observationsBySymbol,
        dataStartDate: params.dataStartDate,
        endDate: params.window.endDate,
      }),
    ),
  );
  const availableReplayDates = params.replay.rows
    .filter((row) => row.scores[params.scoreKey] !== null)
    .map((row) => row.date);
  const unavailableReason = summarizeUnavailableReason(params.scoreKey, params.summary, affectedFactors);

  return {
    unavailableReason,
    affectedFactors,
    replayAvailableCount: params.summary.availableCount,
    replayMissingCount: params.summary.missingCount,
    firstAvailableReplayDate: availableReplayDates[0] ?? null,
    lastAvailableReplayDate: availableReplayDates[availableReplayDates.length - 1] ?? null,
    note: availabilityNote(unavailableReason),
  };
}

function verdictForWindow(
  status: StressWindowStatus,
  summaries: StressWindowScoreSummary[],
  partialReasons: StressWindowPartialReasons,
): StressWindowVerdict {
  if (status === "failed") return "unavailable";
  const focusSummaries = summaries.filter((summary) => summary.focus);
  if (focusSummaries.length === 0) return "unavailable";

  const unavailableCount = focusSummaries.filter((summary) => summary.interpretation === "unavailable").length;
  const unstableCount = focusSummaries.filter((summary) => summary.stability === "unstable").length;
  const focusIssueCount = partialReasons.focusUnavailableScores.length + partialReasons.focusUnstableScores.length;

  if (focusIssueCount >= 2) return "concern";
  if (unavailableCount > focusSummaries.length / 2) return "unavailable";
  if (unstableCount >= 2) return "concern";
  if (unstableCount >= 1 || unavailableCount >= 1) return "watch";
  if (status === "partial") return "watch";
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
      lookbackDays: DEFAULT_REPLAY_LOOKBACK_DAYS,
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
  const dataStartDate = dateKey(addDays(new Date(`${params.window.startDate}T00:00:00Z`), -DEFAULT_REPLAY_LOOKBACK_DAYS));
  const scoreSummaries = macroScoreKeys.map((scoreKey) => {
    const summary = summariesByScore.get(scoreKey);
    const diagnostics = summary
      ? buildAvailabilityDiagnostics({
          scoreKey,
          summary,
          replay,
          window: params.window,
          observationsBySymbol: params.observationsBySymbol,
          dataStartDate,
        })
      : undefined;
    return summary
      ? convertScoreSummary(summary, focusScores, diagnostics)
      : unavailableScoreSummary(scoreKey, focusScores, "Replay did not return this score summary.", diagnostics);
  });
  const status = statusFromReplay(replay);
  const partialReasons = buildPartialReasons(status, scoreSummaries);

  return {
    id: params.window.id,
    label: params.window.label,
    startDate: params.window.startDate,
    endDate: params.window.endDate,
    status,
    verdict: verdictForWindow(status, scoreSummaries, partialReasons),
    description: params.window.description,
    expectedFocus: params.window.expectedFocus,
    replaySummary: {
      replayDates: replay.summary.replayDates,
      successfulDates: replay.summary.successfulDates,
      partialDates: replay.summary.partialDates,
      failedDates: replay.summary.failedDates,
    },
    partialReasons,
    scoreSummaries,
    notes: replay.globalNotes,
  };
}

function failedWindowResult(window: ResolvedStressWindow, message: string): StressWindowReplayWindowResult {
  const focusScores = new Set(window.expectedFocus);
  const scoreSummaries = macroScoreKeys.map((scoreKey) => unavailableScoreSummary(scoreKey, focusScores, message));
  const partialReasons = buildPartialReasons("failed", scoreSummaries);

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
    partialReasons,
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
