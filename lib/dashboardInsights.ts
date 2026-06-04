import type { MacroRegime } from "@/generated/prisma/client";
import type { IndicatorStats } from "@/lib/calculateIndicators";

type RegimeLike = Pick<
  MacroRegime,
  | "finalRegime"
  | "liquidityScore"
  | "inflationScore"
  | "growthScore"
  | "riskAppetiteScore"
  | "dollarScore"
  | "creditScore"
  | "commodityScore"
  | "chinaScore"
>;

export type DashboardInsights = {
  keyDrivers: string[];
  conflictingSignals: string[];
  watchNext: string[];
};

function statMap(stats: IndicatorStats[]): Map<string, IndicatorStats> {
  return new Map(stats.map((item) => [item.indicator.symbol, item]));
}

function change30d(stats: Map<string, IndicatorStats>, symbol: string): number | null {
  return stats.get(symbol)?.change30d ?? null;
}

function isUp(stats: Map<string, IndicatorStats>, symbol: string): boolean {
  const value = change30d(stats, symbol);
  return value !== null && value > 0;
}

function isDown(stats: Map<string, IndicatorStats>, symbol: string): boolean {
  const value = change30d(stats, symbol);
  return value !== null && value < 0;
}

function limit(items: string[], max: number): string[] {
  return items.slice(0, max);
}

export function buildDashboardInsights(regime: RegimeLike, stats: IndicatorStats[]): DashboardInsights {
  const map = statMap(stats);
  const keyDrivers: string[] = [];
  const conflictingSignals: string[] = [];
  const watchNext: string[] = [];

  if (regime.riskAppetiteScore >= 3) {
    keyDrivers.push("風險偏好分數高，代表股指、VIX、信用利差正在支持風險資產。");
  } else if (regime.riskAppetiteScore >= 1) {
    keyDrivers.push("風險偏好分數偏正，市場仍願意承擔一定風險。");
  }

  if (regime.creditScore >= 2) {
    keyDrivers.push("信用分數高，代表高收益債利差仍然健康，信用壓力暫時不明顯。");
  }

  if (regime.growthScore >= 1) {
    keyDrivers.push("增長分數為正，就業和增長數據仍有韌性。");
  }

  if (regime.dollarScore >= 1) {
    keyDrivers.push("美元壓力分數偏高，代表 DXY、USDJPY 或 USDCNH 對流動性形成壓力。");
  }

  if (regime.inflationScore >= 3) {
    keyDrivers.push("通脹分數偏高，代表 CPI/PCE、油價或長端利率仍有壓力。");
  }

  if (regime.commodityScore > 0) {
    keyDrivers.push("商品分數偏正，黃金、白銀、銅或原油提供週期支撐。");
  }

  if (isUp(map, "^GSPC") || isUp(map, "^NDX")) {
    keyDrivers.push("主要美股指數30日走強，對風險偏好形成支持。");
  }

  if (isDown(map, "VIXCLS")) {
    keyDrivers.push("VIX 30日下降，市場波動率壓力減弱。");
  }

  if (regime.riskAppetiteScore >= 3 && regime.liquidityScore < 0) {
    conflictingSignals.push("風險偏好強，但流動性分數為負，代表上漲並不是由寬鬆流動性驅動。");
  }

  if (regime.creditScore >= 2 && regime.dollarScore >= 1) {
    conflictingSignals.push("信用市場健康，但美元壓力偏高，後續要觀察融資壓力是否傳導到信用利差。");
  }

  if (regime.inflationScore >= 3 && regime.commodityScore <= 0) {
    conflictingSignals.push("通脹偏高，但商品分數沒有同步轉強，代表通脹壓力與商品週期信號不完全一致。");
  }

  if (regime.growthScore >= 1 && regime.liquidityScore < 0) {
    conflictingSignals.push("增長仍有韌性，但流動性偏緊，市場對利率變化會更敏感。");
  }

  if (regime.riskAppetiteScore >= 2 && regime.dollarScore >= 2) {
    conflictingSignals.push("風險資產表現較強，但美元壓力也高，這通常不是最舒服的風險偏好環境。");
  }

  if (regime.finalRegime === "高利率風險偏好環境") {
    watchNext.push("DXY 是否繼續上升。");
    watchNext.push("10年期美債收益率是否繼續上行。");
    watchNext.push("VIX 是否重新上升。");
    watchNext.push("高收益債利差是否開始擴大。");
    watchNext.push("商品分數是否由中性轉強或轉弱。");
  } else {
    watchNext.push("DXY 與 USDCNH 是否同步上升。");
    watchNext.push("10年期美債收益率是否突破近期區間。");
    watchNext.push("VIX 與高收益債利差是否給出一致風險信號。");
    watchNext.push("銅、原油和金銀比是否確認商品週期方向。");
  }

  return {
    keyDrivers: limit(keyDrivers.length > 0 ? keyDrivers : ["目前主要指標沒有給出單一清晰支持因素。"], 6),
    conflictingSignals: limit(conflictingSignals.length > 0 ? conflictingSignals : ["目前矛盾信號不明顯，等待美元、利率和信用利差給出更清晰方向。"], 6),
    watchNext: limit(watchNext, 6),
  };
}
