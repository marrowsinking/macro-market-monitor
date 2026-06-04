import type { IndicatorStats } from "@/lib/calculateIndicators";

export type TriggeredAlert = {
  key: string;
  name: string;
  severity: "low" | "medium" | "high";
  message: string;
  indicatorSymbol: string;
  operator: string;
  threshold: number;
};

function mapStats(stats: IndicatorStats[]): Map<string, IndicatorStats> {
  return new Map(stats.map((item) => [item.indicator.symbol, item]));
}

function latest(map: Map<string, IndicatorStats>, symbol: string): number | null {
  return map.get(symbol)?.latestValue ?? null;
}

function change30d(map: Map<string, IndicatorStats>, symbol: string): number | null {
  return map.get(symbol)?.change30d ?? null;
}

function previous(map: Map<string, IndicatorStats>, symbol: string): number | null {
  return map.get(symbol)?.previousValue ?? null;
}

function pctChange30d(map: Map<string, IndicatorStats>, symbol: string): number | null {
  const latestValue = latest(map, symbol);
  const change = change30d(map, symbol);
  if (latestValue === null || change === null) return null;
  const previousValue = latestValue - change;
  if (previousValue === 0) return null;
  return (change / Math.abs(previousValue)) * 100;
}

function goldSilverRatio(map: Map<string, IndicatorStats>): number | null {
  const gold = latest(map, "GC=F");
  const silver = latest(map, "SI=F");
  if (gold === null || silver === null || silver === 0) return null;
  return gold / silver;
}

function pushIf(alerts: TriggeredAlert[], condition: boolean, alert: TriggeredAlert): void {
  if (condition) alerts.push(alert);
}

export function evaluateMacroAlerts(stats: IndicatorStats[]): TriggeredAlert[] {
  const map = mapStats(stats);
  const alerts: TriggeredAlert[] = [];
  const dxyPct = pctChange30d(map, "DX-Y.NYB");
  const vix = latest(map, "VIXCLS");
  const hySpread = latest(map, "BAMLH0A0HYM2");
  const usdcnh = latest(map, "CNH=X");
  const dgs10 = latest(map, "DGS10");
  const t10y2yLatest = latest(map, "T10Y2Y");
  const t10y2yPrevious = previous(map, "T10Y2Y");
  const ratio = goldSilverRatio(map);
  const dgs2Change = change30d(map, "DGS2");
  const wtiPct = pctChange30d(map, "DCOILWTICO");

  pushIf(alerts, dxyPct !== null && dxyPct > 3, {
    key: "dxy-30d-up-3pct",
    name: "DXY 30日上升超過3%",
    severity: "high",
    indicatorSymbol: "DX-Y.NYB",
    operator: ">",
    threshold: 3,
    message: "DXY 30日上升超過3%，美元壓力升高，可能壓制風險資產與商品。",
  });

  pushIf(alerts, vix !== null && vix > 25, {
    key: "vix-above-25",
    name: "VIX 高於25",
    severity: "high",
    indicatorSymbol: "VIXCLS",
    operator: ">",
    threshold: 25,
    message: "VIX 高於25，市場波動率和避險需求升高。",
  });

  pushIf(alerts, hySpread !== null && hySpread > 5, {
    key: "hy-spread-above-5",
    name: "高收益債利差高於5",
    severity: "high",
    indicatorSymbol: "BAMLH0A0HYM2",
    operator: ">",
    threshold: 5,
    message: "High Yield Spread 高於5，信用風險明顯升高。",
  });

  pushIf(alerts, usdcnh !== null && usdcnh > 7.35, {
    key: "usdcnh-above-735",
    name: "USDCNH 高於7.35",
    severity: "medium",
    indicatorSymbol: "CNH=X",
    operator: ">",
    threshold: 7.35,
    message: "USDCNH 高於7.35，人民幣走弱，亞洲資金壓力升高。",
  });

  pushIf(alerts, dgs10 !== null && dgs10 > 5, {
    key: "dgs10-above-5",
    name: "10年期美債收益率高於5",
    severity: "high",
    indicatorSymbol: "DGS10",
    operator: ">",
    threshold: 5,
    message: "10年期美債收益率高於5%，長端利率壓力升高。",
  });

  pushIf(alerts, t10y2yLatest !== null && t10y2yPrevious !== null && t10y2yPrevious < 0 && t10y2yLatest > 0, {
    key: "t10y2y-turns-positive",
    name: "2Y-10Y 利差由負轉正",
    severity: "medium",
    indicatorSymbol: "T10Y2Y",
    operator: ">",
    threshold: 0,
    message: "2Y-10Y 利差從負值轉正，週期位置可能正在切換。",
  });

  pushIf(alerts, ratio !== null && ratio > 90, {
    key: "gold-silver-ratio-above-90",
    name: "金銀比高於90",
    severity: "medium",
    indicatorSymbol: "GOLD_SILVER_RATIO",
    operator: ">",
    threshold: 90,
    message: "Gold/Silver Ratio 高於90，白銀相對弱，市場偏避險或工業需求不足。",
  });

  pushIf(alerts, ratio !== null && ratio < 60, {
    key: "gold-silver-ratio-below-60",
    name: "金銀比低於60",
    severity: "medium",
    indicatorSymbol: "GOLD_SILVER_RATIO",
    operator: "<",
    threshold: 60,
    message: "Gold/Silver Ratio 低於60，白銀相對過熱，商品週期或投機偏熱。",
  });

  pushIf(alerts, dgs2Change !== null && dgs2Change < -0.5, {
    key: "dgs2-down-50bp",
    name: "2年期美債30日下降超過0.5",
    severity: "medium",
    indicatorSymbol: "DGS2",
    operator: "<",
    threshold: -0.5,
    message: "2年期美債收益率30日下降超過0.5，降息預期升溫。",
  });

  pushIf(alerts, wtiPct !== null && wtiPct > 10, {
    key: "wti-30d-up-10pct",
    name: "WTI 30日上升超過10%",
    severity: "medium",
    indicatorSymbol: "DCOILWTICO",
    operator: ">",
    threshold: 10,
    message: "WTI 30日上升超過10%，能源再通脹壓力升高。",
  });

  return alerts;
}
