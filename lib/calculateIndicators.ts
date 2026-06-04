import type { Indicator, Observation } from "@/generated/prisma/client";

export type IndicatorWithObservations = Indicator & {
  observations: Observation[];
};

export type Trend = "rising" | "falling" | "mixed" | "insufficient_data";

export type IndicatorStats = {
  indicator: IndicatorWithObservations;
  latestValue: number | null;
  latestDate: Date | null;
  previousValue: number | null;
  change1d: number | null;
  change7d: number | null;
  change30d: number | null;
  change90d: number | null;
  zScore: number | null;
  percentile: number | null;
  trend: Trend;
  macroMeaning: string;
};

function sortedValues(observations: Observation[]): Observation[] {
  return [...observations].sort((a, b) => a.date.getTime() - b.date.getTime());
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - days);
  return result;
}

function valueAtOrBefore(values: Observation[], targetDate: Date): number | null {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const observation = values[index];
    if (observation.date.getTime() <= targetDate.getTime()) {
      return observation.value;
    }
  }
  return null;
}

function changeFromDays(values: Observation[], latest: Observation | null, days: number): number | null {
  if (!latest || values.length < 2) return null;
  const targetValue = valueAtOrBefore(values, subtractDays(latest.date, days));
  if (targetValue === null) return null;
  return latest.value - targetValue;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function percentileRank(values: number[], latest: number): number {
  const belowOrEqual = values.filter((value) => value <= latest).length;
  return (belowOrEqual / values.length) * 100;
}

function recentYearValues(values: Observation[], latest: Observation | null): number[] {
  if (!latest) return [];
  const start = subtractDays(latest.date, 365);
  return values.filter((item) => item.date.getTime() >= start.getTime() && item.date.getTime() <= latest.date.getTime()).map((item) => item.value);
}

function trendFromChanges(change30d: number | null, change90d: number | null): Trend {
  if (change30d === null || change90d === null) return "insufficient_data";
  if (change30d > 0 && change90d > 0) return "rising";
  if (change30d < 0 && change90d < 0) return "falling";
  return "mixed";
}

export function calculateIndicatorStats(input: IndicatorWithObservations): IndicatorStats {
  const observations = sortedValues(input.observations);
  const latest = observations[observations.length - 1] ?? null;
  const previous = observations[observations.length - 2] ?? null;
  const latestValue = latest?.value ?? null;
  const change1d = latest && previous ? latest.value - previous.value : null;
  const change7d = changeFromDays(observations, latest, 7);
  const change30d = changeFromDays(observations, latest, 30);
  const change90d = changeFromDays(observations, latest, 90);

  let zScore: number | null = null;
  let percentile: number | null = null;
  const yearValues = recentYearValues(observations, latest);

  if (latestValue !== null && yearValues.length >= 2) {
    const deviation = standardDeviation(yearValues);
    zScore = deviation === 0 ? 0 : (latestValue - mean(yearValues)) / deviation;
    percentile = percentileRank(yearValues, latestValue);
  }

  return {
    indicator: input,
    latestValue,
    latestDate: latest?.date ?? null,
    previousValue: previous?.value ?? null,
    change1d,
    change7d,
    change30d,
    change90d,
    zScore,
    percentile,
    trend: trendFromChanges(change30d, change90d),
    macroMeaning: input.macroLogic,
  };
}

export function calculateAllIndicatorStats(inputs: IndicatorWithObservations[]): IndicatorStats[] {
  return inputs.map(calculateIndicatorStats);
}
