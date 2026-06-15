import type { MacroFactorConfig } from "@/lib/config/macroEngineConfig.types";

export type RawObservationPoint = {
  date: Date | string;
  value: number | null;
};

export type TransformedSignalPoint = {
  date: Date;
  value: number;
};

export type TransformStatus =
  | "ok"
  | "not_scored"
  | "insufficient_data"
  | "unsupported_transform"
  | "invalid_data";

export type TransformResult = {
  status: TransformStatus;
  transform: string;
  points: TransformedSignalPoint[];
  latest?: TransformedSignalPoint;
  message?: string;
};

export type RollingStatResult = {
  status: "ok" | "insufficient_data" | "invalid_data";
  latestValue: number | null;
  mean: number | null;
  standardDeviation: number | null;
  zScore: number | null;
  percentile: number | null;
  observationCount: number;
  window: number;
  message?: string;
};

export type NormalizedSignalResult = {
  status: "ok" | "insufficient_data" | "invalid_data";
  rawValue: number | null;
  zScore: number | null;
  percentile: number | null;
  normalizedSignal: number | null;
  window: number | null;
  observationCount: number;
  message?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function validDate(value: Date): boolean {
  return Number.isFinite(value.getTime());
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function resultForPoints(transform: string, points: TransformedSignalPoint[], message?: string): TransformResult {
  if (points.length === 0) {
    return { status: "insufficient_data", transform, points, message: message ?? "Insufficient data after signal transform." };
  }
  return { status: "ok", transform, points, latest: points[points.length - 1] };
}

export function normalizeObservationInput(observations: RawObservationPoint[]): TransformedSignalPoint[] {
  const byDate = new Map<string, TransformedSignalPoint>();

  for (const observation of observations) {
    if (observation.value === null || observation.value === undefined || !Number.isFinite(observation.value)) continue;
    const date = observation.date instanceof Date ? new Date(observation.date) : new Date(observation.date);
    if (!validDate(date)) continue;
    byDate.set(dateKey(date), { date, value: observation.value });
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function findPriorPointByDays(
  points: TransformedSignalPoint[],
  currentDate: Date,
  lookbackDays: number,
): TransformedSignalPoint | null {
  const targetTime = currentDate.getTime() - lookbackDays * DAY_MS;
  let prior: TransformedSignalPoint | null = null;

  for (const point of points) {
    const time = point.date.getTime();
    if (time > targetTime || time >= currentDate.getTime()) continue;
    if (!prior || time > prior.date.getTime()) prior = point;
  }

  return prior;
}

function requireLookback(factorConfig: MacroFactorConfig): number | null {
  return factorConfig.transformLookbackDays ?? null;
}

function previousPoint(points: TransformedSignalPoint[], index: number): TransformedSignalPoint | null {
  return index > 0 ? points[index - 1] : null;
}

function stableNumber(value: number): number {
  return Number(value.toFixed(12));
}

export function transformSignalSeries(
  observations: RawObservationPoint[],
  factorConfig: MacroFactorConfig,
): TransformResult {
  const transform = factorConfig.signalTransform;
  if (transform === "not_scored") return { status: "not_scored", transform, points: [] };
  if (transform === "derived_ratio") {
    return {
      status: "unsupported_transform",
      transform,
      points: [],
      message: "derived_ratio requires multiple input series and is not handled by transformSignalSeries",
    };
  }

  const points = normalizeObservationInput(observations);
  if (points.length === 0) return { status: "invalid_data", transform, points: [], message: "No valid observations." };

  if (transform === "level") return resultForPoints(transform, points);

  const transformed: TransformedSignalPoint[] = [];

  if (transform === "level_change" || transform === "pct_change") {
    const lookbackDays = requireLookback(factorConfig);
    if (lookbackDays === null) {
      return { status: "invalid_data", transform, points: [], message: `${transform} requires transformLookbackDays.` };
    }

    for (const current of points) {
      const prior = findPriorPointByDays(points, current.date, lookbackDays);
      if (!prior) continue;
      if (transform === "level_change") {
        transformed.push({ date: current.date, value: current.value - prior.value });
      } else if (prior.value !== 0) {
        transformed.push({ date: current.date, value: stableNumber(((current.value / prior.value) - 1) * 100) });
      }
    }

    return resultForPoints(transform, transformed);
  }

  if (transform === "yoy_pct") {
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const prior = findPriorPointByDays(points, current.date, 365) ?? (index >= 12 ? points[index - 12] : null);
      if (!prior || prior.value === 0) continue;
      transformed.push({ date: current.date, value: stableNumber(((current.value / prior.value) - 1) * 100) });
    }
    return resultForPoints(transform, transformed);
  }

  if (transform === "mom_change" || transform === "mom_pct") {
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const prior = previousPoint(points, index);
      if (!prior) continue;
      if (transform === "mom_change") {
        transformed.push({ date: current.date, value: current.value - prior.value });
      } else if (prior.value !== 0) {
        transformed.push({ date: current.date, value: stableNumber(((current.value / prior.value) - 1) * 100) });
      }
    }
    return resultForPoints(transform, transformed);
  }

  return { status: "unsupported_transform", transform, points: [], message: `Unsupported signal transform: ${transform}` };
}

export function calculateRollingStats(
  points: TransformedSignalPoint[],
  windowDays: number,
  minObservations: number,
): RollingStatResult {
  const cleanPoints = normalizeObservationInput(points);
  const latest = cleanPoints[cleanPoints.length - 1] ?? null;
  if (!latest) {
    return {
      status: "invalid_data",
      latestValue: null,
      mean: null,
      standardDeviation: null,
      zScore: null,
      percentile: null,
      observationCount: 0,
      window: windowDays,
      message: "No valid transformed points.",
    };
  }

  const windowStartTime = latest.date.getTime() - windowDays * DAY_MS;
  const windowPoints = cleanPoints.filter((point) => point.date.getTime() >= windowStartTime && point.date.getTime() <= latest.date.getTime());
  if (windowPoints.length < minObservations) {
    return {
      status: "insufficient_data",
      latestValue: latest.value,
      mean: null,
      standardDeviation: null,
      zScore: null,
      percentile: null,
      observationCount: windowPoints.length,
      window: windowDays,
      message: "Insufficient observations for rolling statistics.",
    };
  }

  const values = windowPoints.map((point) => point.value);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const standardDeviation = Math.sqrt(variance);
  if (standardDeviation === 0) {
    return {
      status: "invalid_data",
      latestValue: latest.value,
      mean,
      standardDeviation,
      zScore: null,
      percentile: null,
      observationCount: windowPoints.length,
      window: windowDays,
      message: "Cannot calculate z-score because standard deviation is zero.",
    };
  }

  const zScore = (latest.value - mean) / standardDeviation;
  const percentile = (values.filter((value) => value <= latest.value).length / values.length) * 100;

  return {
    status: "ok",
    latestValue: latest.value,
    mean,
    standardDeviation,
    zScore,
    percentile,
    observationCount: windowPoints.length,
    window: windowDays,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function zScoreToNormalizedSignal(
  zScore: number | null,
  zScoreForFullSignal = 2,
): number | null {
  if (zScore === null) return null;
  return clamp(zScore / zScoreForFullSignal, -1, 1);
}

export function calculateNormalizedSignal(
  observations: RawObservationPoint[],
  factorConfig: MacroFactorConfig,
  options?: {
    preferredWindow?: number;
    zScoreForFullSignal?: number;
  },
): NormalizedSignalResult {
  const transformed = transformSignalSeries(observations, factorConfig);
  if (transformed.status !== "ok") {
    return {
      status: transformed.status === "invalid_data" ? "invalid_data" : "insufficient_data",
      rawValue: null,
      zScore: null,
      percentile: null,
      normalizedSignal: null,
      window: null,
      observationCount: transformed.points.length,
      message: transformed.message ?? `Unable to normalize because transform status is ${transformed.status}.`,
    };
  }

  const window = options?.preferredWindow ?? factorConfig.preferredZScoreWindows[0] ?? null;
  if (window === null) {
    return {
      status: "insufficient_data",
      rawValue: transformed.latest?.value ?? null,
      zScore: null,
      percentile: null,
      normalizedSignal: null,
      window: null,
      observationCount: transformed.points.length,
      message: "No preferred z-score window configured.",
    };
  }

  const rolling = calculateRollingStats(transformed.points, window, factorConfig.minObservations);
  if (rolling.status !== "ok") {
    return {
      status: rolling.status,
      rawValue: rolling.latestValue,
      zScore: rolling.zScore,
      percentile: rolling.percentile,
      normalizedSignal: null,
      window,
      observationCount: rolling.observationCount,
      message: rolling.message,
    };
  }

  return {
    status: "ok",
    rawValue: rolling.latestValue,
    zScore: rolling.zScore,
    percentile: rolling.percentile,
    normalizedSignal: zScoreToNormalizedSignal(rolling.zScore, options?.zScoreForFullSignal),
    window,
    observationCount: rolling.observationCount,
  };
}
