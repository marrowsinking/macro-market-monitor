import type { MacroScoreKey } from "@/lib/config/macroEngineConfig.types";

export const shadowScoreDebugOrder: MacroScoreKey[] = [
  "liquidity_score",
  "inflation_score",
  "growth_score",
  "risk_appetite_score",
  "dollar_score",
  "credit_score",
  "commodity_score",
  "china_score",
];

export type DebugStatusTone = "green" | "amber" | "red" | "gray";

export function formatDebugNumber(value: number | null | undefined, options?: { signed?: boolean }): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value === 0) return "0.00";
  const formatted = value.toFixed(2);
  return value > 0 && options?.signed !== false ? `+${formatted}` : formatted;
}

export function statusTone(status: string): DebugStatusTone {
  if (status === "ok") return "green";
  if (status === "partial" || status === "missing_observations" || status === "insufficient_data") return "amber";
  if (status === "no_data" || status === "invalid_data" || status === "unsupported_transform") return "red";
  return "gray";
}

export function buildShadowScoreDebugQuery(params: {
  preferredWindow: string;
  zScoreForFullSignal: string;
  summary: boolean;
}): string {
  const search = new URLSearchParams();
  const preferredWindow = params.preferredWindow.trim();
  const zScoreForFullSignal = params.zScoreForFullSignal.trim();

  if (preferredWindow) search.set("preferredWindow", preferredWindow);
  if (zScoreForFullSignal) search.set("zScoreForFullSignal", zScoreForFullSignal);
  if (params.summary) search.set("summary", "1");

  return search.toString();
}
