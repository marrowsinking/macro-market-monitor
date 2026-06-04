export function formatNumber(value: number | null, digits = 2): string {
  if (value === null || Number.isNaN(value)) return "暫無";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: Math.abs(value) < 10 ? digits : 0,
  }).format(value);
}

export function formatChange(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "暫無";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, 2)}`;
}

export function formatDate(value: Date | null): string {
  if (!value) return "暫無";
  return value.toISOString().slice(0, 10);
}

export function formatDateTime(value: Date | null): string {
  if (!value) return "暫無";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export function scoreTone(value: number): string {
  if (value > 0) return "text-market-green";
  if (value < 0) return "text-market-red";
  return "text-slate-300";
}

export function trendLabel(trend: string): string {
  if (trend === "rising") return "上升";
  if (trend === "falling") return "下降";
  if (trend === "mixed") return "混合";
  if (trend === "insufficient_data") return "數據不足";
  return "暫無";
}
