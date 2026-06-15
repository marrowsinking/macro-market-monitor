import type { IndicatorStats } from "@/lib/calculateIndicators";

export type StatsMap = Map<string, IndicatorStats>;

export type ContributionItem = {
  key: string;
  label: string;
  contribution: number | null;
  interpretation: string;
};

export function change30d(map: StatsMap, symbol: string): number | null {
  return map.get(symbol)?.change30d ?? null;
}

export function change90d(map: StatsMap, symbol: string): number | null {
  return map.get(symbol)?.change90d ?? null;
}

export function latestValue(map: StatsMap, symbol: string): number | null {
  return map.get(symbol)?.latestValue ?? null;
}

export function scoreBySign(value: number | null, positivePoints: number, negativePoints: number): number {
  if (value === null) return 0;
  if (value > 0) return positivePoints;
  if (value < 0) return negativePoints;
  return 0;
}

export function scoreThreshold(value: number | null, threshold: number, abovePoints: number, belowPoints: number): number {
  if (value === null) return 0;
  if (value > threshold) return abovePoints;
  if (value < -threshold) return belowPoints;
  return 0;
}

export function isPositive(value: number | null): boolean {
  return value !== null && value > 0;
}

export function isNegative(value: number | null): boolean {
  return value !== null && value < 0;
}

function pct90d(map: StatsMap, symbol: string): number | null {
  const latest = latestValue(map, symbol);
  const change = change90d(map, symbol);
  if (latest === null || change === null || latest === 0) return null;
  const base = latest - change;
  if (base === 0) return null;
  return (change / Math.abs(base)) * 100;
}

function average(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function inflationIndexGroupContribution(map: StatsMap, symbols: string[], maxContribution: number): number | null {
  const avg = average(symbols.map((symbol) => pct90d(map, symbol)));
  if (avg === null) return null;
  if (avg >= 0.4) return maxContribution;
  if (avg <= -0.1) return -Math.min(0.5, maxContribution);
  return 0;
}

export function inflationContributions(map: StatsMap): ContributionItem[] {
  const headline = inflationIndexGroupContribution(map, ["CPIAUCSL", "PCEPI"], 1);
  const core = inflationIndexGroupContribution(map, ["CPILFESL", "PCEPILFE"], 1.5);
  const energy = scoreBySign(change30d(map, "DCOILWTICO"), 1, -1);
  const rates = scoreBySign(change30d(map, "DGS10"), 0.5, -0.5);

  return [
    {
      key: "headlineInflationGroup",
      label: "整體通脹組",
      contribution: headline,
      interpretation: "CPI 與 PCE 同源性高，先合併成單一整體通脹貢獻，避免重複加分。",
    },
    {
      key: "coreInflationGroup",
      label: "核心通脹組",
      contribution: core,
      interpretation: "Core CPI 與 Core PCE 合併計算，核心通脹組最高貢獻 +1.5。",
    },
    {
      key: "energyInflationGroup",
      label: "能源通脹組",
      contribution: energy,
      interpretation: "原油 30 日上升推高能源通脹壓力，下跌則降低能源再通脹壓力。",
    },
    {
      key: "marketRateGroup",
      label: "市場利率組",
      contribution: rates,
      interpretation: "10 年期美債收益率反映市場對長端利率和通脹風險的定價。",
    },
  ];
}

export function inflationScore(map: StatsMap): number {
  return inflationContributions(map).reduce((sum, item) => sum + (item.contribution ?? 0), 0);
}

export function dollarScore(map: StatsMap): number {
  return (
    scoreBySign(change30d(map, "DX-Y.NYB"), 2, -2) +
    (isPositive(change30d(map, "JPY=X")) ? 0.5 : 0) +
    (isPositive(change30d(map, "CNH=X")) ? 0.5 : 0) +
    scoreBySign(change30d(map, "DGS2"), 1, -1) +
    scoreThreshold(change30d(map, "SOFR"), 0.1, 1, -1) +
    scoreBySign(change30d(map, "BAMLH0A0HYM2"), 1, -1)
  );
}

export function riskAppetiteContributions(map: StatsMap, currentDollarScore = dollarScore(map)): ContributionItem[] {
  const vix = scoreBySign(change30d(map, "VIXCLS"), -1.5, 1.5);
  const credit = scoreBySign(change30d(map, "BAMLH0A0HYM2"), -1.5, 1.5);
  const spx = scoreBySign(change30d(map, "^GSPC"), 0.5, -0.5);
  const ndx = scoreBySign(change30d(map, "^NDX"), 0.5, -0.5);
  const rawEquity = spx + ndx;
  const equity = currentDollarScore >= 3 && rawEquity < -1 ? -1 : rawEquity;

  return [
    {
      key: "volatilityGroup",
      label: "波動率組",
      contribution: vix,
      interpretation: "VIX 是風險偏好的核心信號，權重高於股指 confirmation。",
    },
    {
      key: "creditRiskGroup",
      label: "信用利差組",
      contribution: credit,
      interpretation: "高收益債利差直接反映信用壓力，權重高於股指 confirmation。",
    },
    {
      key: "equityConfirmationGroup",
      label: "股指確認組",
      contribution: equity,
      interpretation: currentDollarScore >= 3
        ? "美元壓力偏高時，股指下跌可能與全球流動性收緊同源，因此股指負貢獻設上限，避免重複扣分。"
        : "S&P 500 與 Nasdaq 只作為風險偏好的確認信號，不作為主導項。",
    },
  ];
}

export function riskAppetiteScore(map: StatsMap, currentDollarScore = dollarScore(map)): number {
  return riskAppetiteContributions(map, currentDollarScore).reduce((sum, item) => sum + (item.contribution ?? 0), 0);
}

export function commodityContributions(map: StatsMap): ContributionItem[] {
  const copperUp = isPositive(change30d(map, "HG=F"));
  const oilUp = isPositive(change30d(map, "DCOILWTICO"));
  const copperDown = isNegative(change30d(map, "HG=F"));
  const oilDown = isNegative(change30d(map, "DCOILWTICO"));
  let industrial = 0;
  if (copperUp && oilUp) industrial = 2;
  else if (copperDown && oilDown) industrial = -2;
  else if (copperUp || oilUp) industrial = 0.5;
  else if (copperDown || oilDown) industrial = -0.5;

  const goldUp = isPositive(change30d(map, "GC=F"));
  const silverUp = isPositive(change30d(map, "SI=F"));

  return [
    {
      key: "growthLedCommodityGroup",
      label: "工業商品組",
      contribution: industrial,
      interpretation: "商品週期主要由銅與原油確認；兩者同步上升才明確支持商品週期。",
    },
    {
      key: "preciousMetalsDefensiveSignal",
      label: "貴金屬防守信號",
      contribution: null,
      interpretation: goldUp || silverUp
        ? "黃金或白銀偏強可能反映避險或抗通脹需求，不直接加入商品週期分數。"
        : "貴金屬未提供明顯防守信號。",
    },
    {
      key: "goldSilverRatioDefensiveSignal",
      label: "金銀比防守信號",
      contribution: null,
      interpretation: "金銀比用作 defensive signal；上升偏避險，不直接推高商品週期分數。",
    },
  ];
}

export function commodityScore(map: StatsMap): number {
  return commodityContributions(map).reduce((sum, item) => sum + (item.contribution ?? 0), 0);
}
