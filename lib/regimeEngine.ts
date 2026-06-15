import type { IndicatorStats } from "@/lib/calculateIndicators";
import {
  commodityScore as computeCommodityScore,
  dollarScore as computeDollarScore,
  inflationScore as computeInflationScore,
  riskAppetiteScore as computeRiskAppetiteScore,
} from "@/lib/scores/scoreLogic";

export type MacroRegimeResult = {
  liquidityScore: number;
  inflationScore: number;
  growthScore: number;
  riskAppetiteScore: number;
  dollarScore: number;
  creditScore: number;
  commodityScore: number;
  chinaScore: number;
  finalRegime: string;
  summary: string;
};

type StatsMap = Map<string, IndicatorStats>;

type GoldSilverRatioState = {
  latest: number | null;
  change30d: number | null;
};

function bySymbol(stats: IndicatorStats[]): StatsMap {
  return new Map(stats.map((item) => [item.indicator.symbol, item]));
}

function change30d(map: StatsMap, symbol: string): number | null {
  return map.get(symbol)?.change30d ?? null;
}

function change90d(map: StatsMap, symbol: string): number | null {
  return map.get(symbol)?.change90d ?? null;
}

function latestValue(map: StatsMap, symbol: string): number | null {
  return map.get(symbol)?.latestValue ?? null;
}

function previousValue(map: StatsMap, symbol: string): number | null {
  return map.get(symbol)?.previousValue ?? null;
}

function scoreBySign(value: number | null, positivePoints: number, negativePoints: number): number {
  if (value === null) return 0;
  if (value > 0) return positivePoints;
  if (value < 0) return negativePoints;
  return 0;
}

function scoreThreshold(value: number | null, threshold: number, abovePoints: number, belowPoints: number): number {
  if (value === null) return 0;
  if (value > threshold) return abovePoints;
  if (value < -threshold) return belowPoints;
  return 0;
}

function isPositive(value: number | null): boolean {
  return value !== null && value > 0;
}

function isNegative(value: number | null): boolean {
  return value !== null && value < 0;
}

function goldSilverRatioState(map: StatsMap): GoldSilverRatioState {
  const goldLatest = latestValue(map, "GC=F");
  const silverLatest = latestValue(map, "SI=F");
  const goldPrevious = previousValue(map, "GC=F");
  const silverPrevious = previousValue(map, "SI=F");

  const latest = goldLatest !== null && silverLatest !== null && silverLatest !== 0 ? goldLatest / silverLatest : null;
  const previous = goldPrevious !== null && silverPrevious !== null && silverPrevious !== 0 ? goldPrevious / silverPrevious : null;

  return {
    latest,
    change30d: latest !== null && previous !== null ? latest - previous : null,
  };
}

function buildSummary(
  regime: string,
  scores: Omit<MacroRegimeResult, "finalRegime" | "summary">,
  map: StatsMap,
  ratio: GoldSilverRatioState,
): string {
  const commodityNote =
    isPositive(change30d(map, "GC=F")) && isNegative(change30d(map, "HG=F")) && isNegative(change30d(map, "DCOILWTICO"))
      ? "黃金偏強可能反映避險或抗通脹需求，但銅和原油未確認商品週期改善。"
      : null;
  const industrialReflationNote =
    isPositive(change30d(map, "HG=F")) && isPositive(change30d(map, "DCOILWTICO")) ? "銅和原油同步上升，工業/能源再通脹確認。" : null;
  const asiaFundingNote =
    isPositive(change30d(map, "DX-Y.NYB")) && isPositive(change30d(map, "CNH=X")) ? "DXY與USDCNH同步上升，亞洲資金壓力增加。" : null;
  const inflationPressureNote =
    scores.inflationScore >= 3 ? "通脹壓力由核心通脹、能源價格或長端利率共同推動。" : null;
  const dollarRiskDoubleCountNote =
    scores.dollarScore >= 3 && scores.riskAppetiteScore < 0
      ? "美元壓力與風險偏好可能來自同一條全球流動性收緊主線，需避免重複解讀。"
      : null;
  const goldSilverNotes: string[] = [];
  if (ratio.latest !== null && ratio.latest > 90) {
    goldSilverNotes.push("金銀比高於90，白銀相對弱，市場偏避險或工業需求不足。");
  } else if (ratio.latest !== null && ratio.latest < 60) {
    goldSilverNotes.push("金銀比低於60，白銀相對過熱，商品週期或投機偏熱。");
  }
  if (ratio.change30d !== null && ratio.change30d < 0) {
    goldSilverNotes.push("金銀比30日下降，白銀相對黃金轉強，偏風險/週期。");
  } else if (ratio.change30d !== null && ratio.change30d > 0) {
    goldSilverNotes.push("金銀比30日上升，黃金相對白銀轉強，偏避險。");
  }
  const extraNotes = [asiaFundingNote, industrialReflationNote, commodityNote, inflationPressureNote, dollarRiskDoubleCountNote, ...goldSilverNotes].filter(Boolean);
  const noteSentence = extraNotes.length > 0 ? extraNotes.join(" ") : null;

  if (regime === "再通脹交易") {
    return [
      "目前市場偏向再通脹交易。",
      "通脹相關價格指數、能源價格或10年期美債收益率正在給出上行信號，代表市場重新定價通脹和長端利率壓力。",
      "這種環境下，商品與週期資產可能相對受支持，但長久期科技股和估值較高的風險資產容易承壓。",
      noteSentence,
      "注意：CPI/PCE 第一版先用90日變化判斷，後續應改成同比或環比年化。",
    ].filter(Boolean).join(" ");
  }

  if (regime === "衰退降息交易") {
    return [
      "目前市場偏向衰退降息交易。",
      "增長與就業相關指標轉弱，同時2年期美債收益率下行，代表市場開始押注美聯儲未來轉向寬鬆。",
      "這種環境下，黃金和高質量債券相對有利，但股票風險資產需要觀察盈利下修壓力。",
      "如果信用利差同步擴大，衰退壓力會比單純降息交易更嚴重。",
    ].join(" ");
  }

  if (regime === "避險模式") {
    return [
      "目前市場偏向避險模式。",
      "VIX上升、信用利差擴大，代表資金風險偏好下降。",
      "這種環境下，市場容易出現美元、黃金或短債等避險資產相對強勢，而股票和高收益債承壓。",
      noteSentence ?? "需要繼續觀察信用利差是否持續擴大。",
    ].filter(Boolean).join(" ");
  }

  if (regime === "風險偏好模式") {
    return [
      "目前市場偏向風險偏好模式。",
      "波動率和信用利差改善，同時流動性分數偏正，代表資金願意重新承擔風險。",
      "這種環境下，股票、高收益債和部分週期資產通常更容易受支持。",
      noteSentence,
      "仍需要觀察通脹分數是否過高，否則長端利率上行可能壓制估值。",
    ].filter(Boolean).join(" ");
  }

  if (regime === "高利率風險偏好環境") {
    return [
      "目前市場呈現高利率下的風險偏好。",
      "風險資產與信用市場表現較強，增長數據仍有韌性，但美元壓力和流動性條件並不寬鬆。",
      "這種環境下市場仍可能維持強勢，但對美債收益率、美元指數和通脹數據會更加敏感。",
      scores.inflationScore >= 3 ? "通脹壓力仍然偏高，若長端利率繼續上行，可能重新壓制估值較高的資產。" : null,
      noteSentence,
    ].filter(Boolean).join(" ");
  }

  if (regime === "高利率韌性環境") {
    return [
      "目前市場呈現高利率韌性環境。",
      "通脹壓力偏高，但增長和風險偏好仍有支撐，代表市場暫時能承受較高利率。",
      "這種環境下資產價格可能維持震盪偏強，但估值對長端利率和美元變化會更敏感。",
      noteSentence,
    ].filter(Boolean).join(" ");
  }

  if (regime === "美元/流動性收緊模式") {
    return [
      "目前市場偏向美元/流動性收緊模式。",
      "短端利率、SOFR或信用利差給出收緊信號，代表美元融資條件變得更緊。",
      "這種環境下，風險資產和高槓桿資產容易承壓，市場更依賴流動性改善信號才能修復。",
      noteSentence,
    ].filter(Boolean).join(" ");
  }

  if (regime === "商品/黃金強勢模式") {
    return [
      "目前市場偏向商品/黃金強勢模式。",
      "商品分數偏強主要需要由銅和原油等工業商品確認，黃金上升本身不等於全面商品週期改善。",
      noteSentence ?? "如果原油和長端利率同步上行，再通脹壓力會更明顯。",
      "需要區分黃金避險上漲和全面商品週期上漲，兩者對股票風格的含義不同。",
    ].filter(Boolean).join(" ");
  }

  if (regime === "通脹壓力偏高") {
    return [
      "目前市場主要信號是通脹壓力偏高。",
      "通脹相關指標較強，但商品分數沒有同步確認，代表這更像價格黏性或利率壓力，而不是全面商品週期。",
      "這種環境下，市場需要觀察長端利率是否繼續上行，以及風險資產估值是否承壓。",
      "注意：CPI/PCE 第一版先用90日變化判斷，後續應改成同比或環比年化。",
      noteSentence,
    ].filter(Boolean).join(" ");
  }

  return [
    "目前市場沒有形成單一清晰主線。",
    "部分指標支持風險偏好，但流動性、利率或通脹信號仍然互相矛盾。",
    `目前流動性分數為${scores.liquidityScore.toFixed(1)}，通脹分數為${scores.inflationScore.toFixed(1)}，增長分數為${scores.growthScore.toFixed(1)}，信用分數為${scores.creditScore.toFixed(1)}。`,
    noteSentence,
    "這種環境下不宜單靠方向性判斷，應等待美元、利率和信用利差給出更一致的信號。",
    "中國宏觀第一版暫無數據，chinaScore 固定為0。",
  ].filter(Boolean).join(" ");
}

export function calculateMacroRegime(stats: IndicatorStats[]): MacroRegimeResult {
  const map = bySymbol(stats);

  const dgs2Change30d = change30d(map, "DGS2");
  const dgs10Change30d = change30d(map, "DGS10");
  const sofrChange30d = change30d(map, "SOFR");
  const highYieldSpreadChange30d = change30d(map, "BAMLH0A0HYM2");
  const oilChange30d = change30d(map, "DCOILWTICO");
  const dxyChange30d = change30d(map, "DX-Y.NYB");
  const goldChange30d = change30d(map, "GC=F");
  const copperChange30d = change30d(map, "HG=F");

  const liquidityScore =
    scoreBySign(dgs2Change30d, -1, 1) +
    scoreBySign(change30d(map, "WALCL"), 1, -1) +
    scoreBySign(change30d(map, "RRPONTSYD"), -0.5, 0.5) +
    scoreThreshold(sofrChange30d, 0.1, -1, 1) +
    scoreBySign(highYieldSpreadChange30d, -1, 1);

  const inflationScore = computeInflationScore(map);

  const growthScore =
    scoreBySign(change90d(map, "UNRATE"), -1, 1) +
    scoreBySign(change30d(map, "ICSA"), -1, 1) +
    scoreBySign(change90d(map, "PAYEMS"), 1, -1) +
    scoreBySign(change90d(map, "JTSJOL"), 1, -1);

  const dollarScore = computeDollarScore(map);
  const riskAppetiteScore = computeRiskAppetiteScore(map, dollarScore);

  const creditScore =
    scoreBySign(highYieldSpreadChange30d, -2, 2) +
    (latestValue(map, "BAMLH0A0HYM2") !== null && latestValue(map, "BAMLH0A0HYM2")! > 5 ? -1 : 0) +
    (latestValue(map, "BAMLH0A0HYM2") !== null && latestValue(map, "BAMLH0A0HYM2")! < 4 ? 1 : 0);

  const commodityScore = computeCommodityScore(map);

  const chinaScore = 0;
  const ratio = goldSilverRatioState(map);

  let finalRegime = "混合震盪模式";
  if (riskAppetiteScore <= -2 && creditScore <= -1) {
    finalRegime = "避險模式";
  } else if (growthScore <= -2 && isNegative(dgs2Change30d)) {
    finalRegime = "衰退降息交易";
  } else if (inflationScore >= 3 && isPositive(dgs10Change30d) && commodityScore >= 1) {
    finalRegime = "再通脹交易";
  } else if (riskAppetiteScore >= 3 && creditScore >= 2 && growthScore >= 1 && liquidityScore < 0 && dollarScore >= 1) {
    finalRegime = "高利率風險偏好環境";
  } else if (inflationScore >= 3 && growthScore >= 1 && riskAppetiteScore >= 1 && liquidityScore < 0) {
    finalRegime = "高利率韌性環境";
  } else if (riskAppetiteScore >= 2 && liquidityScore >= 1) {
    finalRegime = "風險偏好模式";
  } else if (liquidityScore <= -2 && dollarScore >= 2) {
    finalRegime = "美元/流動性收緊模式";
  } else if (commodityScore >= 2) {
    finalRegime = "商品/黃金強勢模式";
  } else if (inflationScore >= 3 && commodityScore < 1) {
    finalRegime = "通脹壓力偏高";
  }

  const scores = {
    liquidityScore,
    inflationScore,
    growthScore,
    riskAppetiteScore,
    dollarScore,
    creditScore,
    commodityScore,
    chinaScore,
  };

  return {
    ...scores,
    finalRegime,
    summary: buildSummary(finalRegime, scores, map, ratio),
  };
}
