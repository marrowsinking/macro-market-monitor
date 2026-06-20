import { macroScoreKeys } from "@/lib/config/macroEngineConfig";
import type { MacroScoreKey } from "@/lib/config/macroEngineConfig.types";
import {
  calculateAllShadowScores,
  type ObservationSeriesMap,
} from "@/lib/engines/shadowScoreEngine";

export type HistoricalReplayRowStatus = "ok" | "partial" | "failed";
export type HistoricalReplayStability = "stable" | "watch" | "unstable" | "unavailable";

export interface HistoricalReplayResult {
  generatedAt: string;
  engineVersion: "historical-replay-debug";
  params: {
    days: number;
    step: number;
    startDate: string;
    endDate: string;
  };
  summary: {
    replayDates: number;
    successfulDates: number;
    partialDates: number;
    failedDates: number;
    stableScores: number;
    watchScores: number;
    unstableScores: number;
    unavailableScores: number;
    scoreSummaries: HistoricalReplayScoreSummary[];
  };
  rows: HistoricalReplayRow[];
  globalNotes: string[];
}

export interface HistoricalReplayRow {
  date: string;
  status: HistoricalReplayRowStatus;
  scores: Record<MacroScoreKey, number | null>;
  unavailableScores: MacroScoreKey[];
  notes: string[];
}

export interface HistoricalReplayScoreSummary {
  scoreKey: MacroScoreKey;
  label: string;
  availableCount: number;
  missingCount: number;
  average: number | null;
  min: number | null;
  max: number | null;
  latest: number | null;
  signFlipCount: number;
  largeMoveCount: number;
  saturationCount: number;
  stability: HistoricalReplayStability;
  notes: string[];
}

export type HistoricalReplayParams = {
  days?: number | null;
  step?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  lookbackDays?: number | null;
};

type ScoreCalculator = (params: {
  asOfDate: string;
  observationsBySymbol: ObservationSeriesMap;
}) => Record<MacroScoreKey, number | null>;

const DAY_MS = 24 * 60 * 60 * 1000;
const NEUTRAL_THRESHOLD = 0.25;
export const DEFAULT_REPLAY_LOOKBACK_DAYS = 1095;

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

function dateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function parseDateKey(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function clamp(value: number | null | undefined, min: number, max: number, fallback: number): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function stableNumber(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(6));
}

export function clampReplayParams(params: HistoricalReplayParams): { days: number; step: number } {
  return {
    days: clamp(params.days, 30, 365, 90),
    step: clamp(params.step, 1, 10, 1),
  };
}

function signBucket(value: number): "positive" | "negative" | "neutral" {
  if (value > NEUTRAL_THRESHOLD) return "positive";
  if (value < -NEUTRAL_THRESHOLD) return "negative";
  return "neutral";
}

export function countSignFlips(values: Array<number | null>): number {
  let previous: "positive" | "negative" | null = null;
  let flips = 0;

  for (const value of values) {
    if (value === null || !Number.isFinite(value)) continue;
    const current = signBucket(value);
    if (current === "neutral") continue;
    if (previous !== null && previous !== current) flips += 1;
    previous = current;
  }

  return flips;
}

export function countLargeMoves(values: Array<number | null>): number {
  let previous: number | null = null;
  let count = 0;

  for (const value of values) {
    if (value === null || !Number.isFinite(value)) continue;
    if (previous !== null && Math.abs(value - previous) >= 1) count += 1;
    previous = value;
  }

  return count;
}

export function countSaturation(values: Array<number | null>): number {
  return values.filter((value) => value !== null && Number.isFinite(value) && Math.abs(value) >= 3.5).length;
}

export function classifyReplayStability(params: {
  availableCount: number;
  signFlipCount: number;
  largeMoveCount: number;
  saturationCount: number;
}): HistoricalReplayStability {
  if (params.availableCount < 10) return "unavailable";
  if (params.signFlipCount <= 2 && params.largeMoveCount <= 5 && params.saturationCount <= 3) return "stable";
  if (params.signFlipCount <= 5 && params.largeMoveCount <= 12) return "watch";
  return "unstable";
}

export function buildReplayRow(date: string, scores: Record<MacroScoreKey, number | null>, notes: string[] = []): HistoricalReplayRow {
  const normalizedScores = macroScoreKeys.reduce((acc, scoreKey) => {
    acc[scoreKey] = stableNumber(scores[scoreKey] ?? null);
    return acc;
  }, {} as Record<MacroScoreKey, number | null>);
  const unavailableScores = macroScoreKeys.filter((scoreKey) => normalizedScores[scoreKey] === null);

  return {
    date,
    status: unavailableScores.length === 0 ? "ok" : unavailableScores.length === macroScoreKeys.length ? "failed" : "partial",
    scores: normalizedScores,
    unavailableScores,
    notes,
  };
}

export function buildScoreSummary(scoreKey: MacroScoreKey, rows: HistoricalReplayRow[]): HistoricalReplayScoreSummary {
  const values = rows.map((row) => row.scores[scoreKey]);
  const finiteValues = values.filter((value): value is number => value !== null && Number.isFinite(value));
  const average =
    finiteValues.length === 0
      ? null
      : stableNumber(finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length);
  const signFlipCount = countSignFlips(values);
  const largeMoveCount = countLargeMoves(values);
  const saturationCount = countSaturation(values);
  const stability = classifyReplayStability({
    availableCount: finiteValues.length,
    signFlipCount,
    largeMoveCount,
    saturationCount,
  });
  const notes: string[] = [];

  if (stability === "unavailable") notes.push("Fewer than 10 replay dates have finite values.");
  if (signFlipCount > 0) notes.push(`${signFlipCount} directional sign flips.`);
  if (largeMoveCount > 0) notes.push(`${largeMoveCount} large moves >= 1.0.`);
  if (saturationCount > 0) notes.push(`${saturationCount} saturated values with abs(score) >= 3.5.`);

  return {
    scoreKey,
    label: scoreLabels[scoreKey],
    availableCount: finiteValues.length,
    missingCount: rows.length - finiteValues.length,
    average,
    min: finiteValues.length === 0 ? null : stableNumber(Math.min(...finiteValues)),
    max: finiteValues.length === 0 ? null : stableNumber(Math.max(...finiteValues)),
    latest: finiteValues.length === 0 ? null : stableNumber(finiteValues[finiteValues.length - 1]),
    signFlipCount,
    largeMoveCount,
    saturationCount,
    stability,
    notes,
  };
}

export function buildReplayDates(params: { days: number; step: number; endDate: Date }): string[] {
  const startDate = addDays(params.endDate, -params.days + 1);
  const dates: string[] = [];

  for (let offset = 0; offset < params.days; offset += params.step) {
    dates.push(dateKey(addDays(startDate, offset)));
  }
  const endKey = dateKey(params.endDate);
  if (!dates.includes(endKey)) dates.push(endKey);
  return dates;
}

export function buildReplayDatesForRange(params: { startDate: Date; endDate: Date; step: number }): string[] {
  const start = dateKey(params.startDate) <= dateKey(params.endDate) ? params.startDate : params.endDate;
  const end = dateKey(params.startDate) <= dateKey(params.endDate) ? params.endDate : params.startDate;
  const totalDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1);
  const dates: string[] = [];

  for (let offset = 0; offset < totalDays; offset += params.step) {
    dates.push(dateKey(addDays(start, offset)));
  }
  const endKey = dateKey(end);
  if (!dates.includes(endKey)) dates.push(endKey);
  return dates;
}

export function filterObservationsAsOf(
  observationsBySymbol: ObservationSeriesMap,
  asOfDate: string,
  fromDate?: string | null,
): ObservationSeriesMap {
  const result: ObservationSeriesMap = {};
  for (const [symbol, points] of Object.entries(observationsBySymbol)) {
    const filtered = points.filter((point) => {
      const pointDate = dateKey(point.date);
      return pointDate <= asOfDate && (!fromDate || pointDate >= fromDate);
    });
    if (filtered.length > 0) result[symbol] = filtered;
  }
  return result;
}

function defaultScoreCalculator(params: {
  observationsBySymbol: ObservationSeriesMap;
}): Record<MacroScoreKey, number | null> {
  const results = calculateAllShadowScores({
    observationsBySymbol: params.observationsBySymbol,
  });

  return macroScoreKeys.reduce((acc, scoreKey) => {
    const score = results[scoreKey];
    acc[scoreKey] = score.status === "no_data" || score.status === "not_scored" ? null : score.value;
    return acc;
  }, {} as Record<MacroScoreKey, number | null>);
}

export function buildHistoricalReplayResult(params: {
  observationsBySymbol: ObservationSeriesMap;
  params?: HistoricalReplayParams;
  endDate?: Date;
  generatedAt?: Date;
  calculateScores?: ScoreCalculator;
}): HistoricalReplayResult {
  const replayParams = clampReplayParams(params.params ?? {});
  const requestedStartDate = parseDateKey(params.params?.startDate);
  const requestedEndDate = parseDateKey(params.params?.endDate);
  const endDate = requestedEndDate ?? params.endDate ?? new Date();
  const hasCustomRange = Boolean(requestedStartDate || requestedEndDate);
  const dates =
    hasCustomRange
      ? buildReplayDatesForRange({
          startDate: requestedStartDate ?? addDays(endDate, -replayParams.days + 1),
          endDate,
          step: replayParams.step,
        })
      : buildReplayDates({ ...replayParams, endDate });
  const replayStartDate = dates[0] ? new Date(`${dates[0]}T00:00:00Z`) : endDate;
  const lookbackDays = clamp(params.params?.lookbackDays, 0, 3650, DEFAULT_REPLAY_LOOKBACK_DAYS);
  const dataStartDate = hasCustomRange ? dateKey(addDays(replayStartDate, -lookbackDays)) : null;
  const calculateScores = params.calculateScores ?? defaultScoreCalculator;
  const rows = dates.map((asOfDate) => {
    try {
      return buildReplayRow(
        asOfDate,
        calculateScores({
          asOfDate,
          observationsBySymbol: filterObservationsAsOf(params.observationsBySymbol, asOfDate, dataStartDate),
        }),
      );
    } catch (error) {
      return buildReplayRow(
        asOfDate,
        {
          liquidity_score: null,
          inflation_score: null,
          growth_score: null,
          risk_appetite_score: null,
          dollar_score: null,
          credit_score: null,
          commodity_score: null,
          china_score: null,
        },
        [error instanceof Error ? error.message : "Replay score calculation failed."],
      );
    }
  });
  const scoreSummaries = macroScoreKeys.map((scoreKey) => buildScoreSummary(scoreKey, rows));

  return {
    generatedAt: (params.generatedAt ?? new Date()).toISOString(),
    engineVersion: "historical-replay-debug",
    params: {
      days: dates.length > 0 ? Math.floor((new Date(`${dates[dates.length - 1]}T00:00:00Z`).getTime() - new Date(`${dates[0]}T00:00:00Z`).getTime()) / DAY_MS) + 1 : replayParams.days,
      step: replayParams.step,
      startDate: dates[0],
      endDate: dates[dates.length - 1] ?? dateKey(endDate),
    },
    summary: {
      replayDates: rows.length,
      successfulDates: rows.filter((row) => row.status === "ok").length,
      partialDates: rows.filter((row) => row.status === "partial").length,
      failedDates: rows.filter((row) => row.status === "failed").length,
      stableScores: scoreSummaries.filter((summary) => summary.stability === "stable").length,
      watchScores: scoreSummaries.filter((summary) => summary.stability === "watch").length,
      unstableScores: scoreSummaries.filter((summary) => summary.stability === "unstable").length,
      unavailableScores: scoreSummaries.filter((summary) => summary.stability === "unavailable").length,
      scoreSummaries,
    },
    rows,
    globalNotes: [
      "Debug-only replay uses observations with date <= asOfDate to avoid look-ahead bias.",
      "Rows are computed from v2 shadow scores and do not affect official dashboard, regimes, alerts, or persisted data.",
    ],
  };
}
