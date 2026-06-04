import type { Alert, Indicator } from "@/generated/prisma/client";
import type { IndicatorStats } from "@/lib/calculateIndicators";

export type AlertWithIndicator = Alert & { indicator: Indicator };

export type AlertView = AlertWithIndicator & {
  latestValue: number | null;
  isTriggered: boolean;
};

function compare(value: number, operator: string, threshold: number): boolean {
  if (operator === ">") return value > threshold;
  if (operator === ">=") return value >= threshold;
  if (operator === "<") return value < threshold;
  if (operator === "<=") return value <= threshold;
  if (operator === "=") return value === threshold;
  throw new Error(`Unsupported alert operator: ${operator}`);
}

export function calculateGoldSilverRatio(stats: IndicatorStats[]): number | null {
  const gold = stats.find((item) => item.indicator.symbol === "GC=F")?.latestValue ?? null;
  const silver = stats.find((item) => item.indicator.symbol === "SI=F")?.latestValue ?? null;
  if (gold === null || silver === null || silver === 0) return null;
  return gold / silver;
}

export function evaluateAlerts(alerts: AlertWithIndicator[], stats: IndicatorStats[]): AlertView[] {
  const statMap = new Map(stats.map((item) => [item.indicator.symbol, item.latestValue]));
  const goldSilverRatio = calculateGoldSilverRatio(stats);

  return alerts.map((alert) => {
    const latestValue = alert.indicator.symbol === "GOLD_SILVER_RATIO" ? goldSilverRatio : (statMap.get(alert.indicator.symbol) ?? null);
    return {
      ...alert,
      latestValue,
      isTriggered: alert.isActive && latestValue !== null ? compare(latestValue, alert.operator, alert.threshold) : false,
    };
  });
}
