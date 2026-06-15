import type { Observation } from "@/generated/prisma/client";
import type { IndicatorStats } from "@/lib/calculateIndicators";
import { isIndicatorActive } from "@/lib/indicators/indicatorVisibility";
import { commodityContributions, inflationContributions, riskAppetiteContributions, type ContributionItem } from "@/lib/scores/scoreLogic";

export type ScoreFactor = {
  symbol: string;
  name: string;
  source: string;
  latestValue: number | null;
  latestDate: string | null;
  change3d: number | null;
  change30d: number | null;
  contribution: number | null;
  groupContribution: number | null;
  factorContribution: number | null;
  direction: "positive" | "negative" | "neutral" | "unknown";
  interpretation: string;
};

export type ScoreBreakdown = {
  key: string;
  nameZh: string;
  score: number | null;
  statusLabel: string;
  description: string;
  factors: ScoreFactor[];
};

type ScoreLike = {
  liquidityScore: number;
  inflationScore: number;
  growthScore: number;
  riskAppetiteScore: number;
  dollarScore: number;
  creditScore: number;
  commodityScore: number;
  chinaScore: number;
};

type FactorDef = {
  symbol: string;
  name: string;
  contribution: (map: Map<string, IndicatorStats>) => number | null;
  interpretation: (factor: Pick<ScoreFactor, "change30d" | "contribution" | "latestValue">) => string;
};

type ScoreDef = {
  key: keyof ScoreLike;
  outputKey: string;
  nameZh: string;
  description: string;
  factors: FactorDef[];
};

function sortedObservations(stats: IndicatorStats | undefined): Observation[] {
  return stats?.indicator.observations.slice().sort((a, b) => a.date.getTime() - b.date.getTime()) ?? [];
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - days);
  return result;
}

function valueAtOrBefore(values: Observation[], targetDate: Date): number | null {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index].date.getTime() <= targetDate.getTime()) return values[index].value;
  }
  return null;
}

function changeFromDays(values: Observation[], days: number): number | null {
  const latest = values[values.length - 1] ?? null;
  if (!latest || values.length < 2) return null;
  const base = valueAtOrBefore(values, subtractDays(latest.date, days));
  return base === null ? null : latest.value - base;
}

function latestDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function signContribution(value: number | null, positivePoints: number, negativePoints: number): number | null {
  if (value === null) return null;
  if (value > 0) return positivePoints;
  if (value < 0) return negativePoints;
  return 0;
}

function thresholdContribution(value: number | null, threshold: number, abovePoints: number, belowPoints: number): number | null {
  if (value === null) return null;
  if (value > threshold) return abovePoints;
  if (value < -threshold) return belowPoints;
  return 0;
}

function latest(map: Map<string, IndicatorStats>, symbol: string): number | null {
  return map.get(symbol)?.latestValue ?? null;
}

function ch30(map: Map<string, IndicatorStats>, symbol: string): number | null {
  return map.get(symbol)?.change30d ?? null;
}

function ch90(map: Map<string, IndicatorStats>, symbol: string): number | null {
  return map.get(symbol)?.change90d ?? null;
}

function direction(contribution: number | null): ScoreFactor["direction"] {
  if (contribution === null) return "unknown";
  if (contribution > 0) return "positive";
  if (contribution < 0) return "negative";
  return "neutral";
}

function isGroupOrSignalFactor(symbol: string): boolean {
  return symbol.includes("Group") || symbol.includes("Signal") || symbol === "Gold/Silver Ratio";
}

function basicInterpretation(label: string, positive: string, negative: string) {
  return (factor: Pick<ScoreFactor, "change30d" | "contribution">) => {
    if (factor.contribution === null) return `${label} 數據不足。`;
    if (factor.change30d === null) return `${label} 30日變化暫無，暫不判斷。`;
    if (factor.contribution > 0) return positive;
    if (factor.contribution < 0) return negative;
    return `${label} 30日變化不明顯，影響中性。`;
  };
}

function staticInterpretation(text: string) {
  return () => text;
}

function contributionByKey(items: ContributionItem[], key: string): number | null {
  return items.find((item) => item.key === key)?.contribution ?? null;
}

function goldSilverFactor(map: Map<string, IndicatorStats>): Pick<ScoreFactor, "latestValue" | "latestDate" | "change3d" | "change30d"> {
  const goldValues = sortedObservations(map.get("GC=F"));
  const silverValues = sortedObservations(map.get("SI=F"));
  const goldLatest = goldValues[goldValues.length - 1] ?? null;
  const silverLatest = silverValues[silverValues.length - 1] ?? null;
  if (!goldLatest || !silverLatest || silverLatest.value === 0) {
    return { latestValue: null, latestDate: null, change3d: null, change30d: null };
  }

  const latestRatio = goldLatest.value / silverLatest.value;
  const date = goldLatest.date.getTime() <= silverLatest.date.getTime() ? goldLatest.date : silverLatest.date;
  const ratioAt = (days: number) => {
    const gold = valueAtOrBefore(goldValues, subtractDays(date, days));
    const silver = valueAtOrBefore(silverValues, subtractDays(date, days));
    return gold !== null && silver !== null && silver !== 0 ? gold / silver : null;
  };
  const ratio3d = ratioAt(3);
  const ratio30d = ratioAt(30);

  return {
    latestValue: latestRatio,
    latestDate: latestDate(date),
    change3d: ratio3d === null ? null : latestRatio - ratio3d,
    change30d: ratio30d === null ? null : latestRatio - ratio30d,
  };
}

const definitions: ScoreDef[] = [
  {
    key: "liquidityScore",
    outputKey: "liquidity_score",
    nameZh: "流動性",
    description: "衡量美元短端利率、Fed 資產負債表、逆回購與信用利差對流動性的影響。",
    factors: [
      { symbol: "DGS2", name: "2-Year Treasury Yield", contribution: (m) => signContribution(ch30(m, "DGS2"), -1, 1), interpretation: basicInterpretation("2年期美債", "2年期美債下行，支持流動性改善。", "2年期美債上行，代表短端利率壓力增加。") },
      { symbol: "WALCL", name: "Fed Balance Sheet", contribution: (m) => signContribution(ch30(m, "WALCL"), 1, -1), interpretation: basicInterpretation("Fed資產負債表", "Fed資產負債表上升，支持流動性。", "Fed資產負債表下降，流動性偏收縮。") },
      { symbol: "RRPONTSYD", name: "Reverse Repo", contribution: (m) => signContribution(ch30(m, "RRPONTSYD"), -0.5, 0.5), interpretation: basicInterpretation("逆回購", "逆回購下降，釋放流動性。", "逆回購上升，吸收流動性。") },
      { symbol: "SOFR", name: "SOFR", contribution: (m) => thresholdContribution(ch30(m, "SOFR"), 0.1, -1, 1), interpretation: basicInterpretation("SOFR", "SOFR下降，短端資金壓力緩和。", "SOFR上升超過閾值，短端資金壓力增加。") },
      { symbol: "BAMLH0A0HYM2", name: "High Yield Spread", contribution: (m) => signContribution(ch30(m, "BAMLH0A0HYM2"), -1, 1), interpretation: basicInterpretation("信用利差", "信用利差下降，信用壓力回落，支持流動性。", "信用利差擴大，金融條件偏緊。") },
    ],
  },
  {
    key: "inflationScore",
    outputKey: "inflation_score",
    nameZh: "通脹壓力",
    description: "衡量 CPI、PCE、能源價格與長端利率對通脹壓力的影響。",
    factors: [
      { symbol: "headlineInflationGroup", name: "整體通脹組", contribution: (m) => contributionByKey(inflationContributions(m), "headlineInflationGroup"), interpretation: staticInterpretation("CPI 與 PCE 同源性高，先合併成單一整體通脹貢獻，避免重複加分。") },
      { symbol: "coreInflationGroup", name: "核心通脹組", contribution: (m) => contributionByKey(inflationContributions(m), "coreInflationGroup"), interpretation: staticInterpretation("Core CPI 與 Core PCE 合併計算，核心通脹組最高貢獻 +1.5。") },
      { symbol: "energyInflationGroup", name: "能源通脹組", contribution: (m) => contributionByKey(inflationContributions(m), "energyInflationGroup"), interpretation: staticInterpretation("原油 30 日上升推高能源通脹壓力，下跌則降低能源再通脹壓力。") },
      { symbol: "marketRateGroup", name: "市場利率組", contribution: (m) => contributionByKey(inflationContributions(m), "marketRateGroup"), interpretation: staticInterpretation("10 年期美債收益率反映市場對長端利率和通脹風險的定價。") },
      { symbol: "CPIAUCSL", name: "CPI", contribution: () => null, interpretation: staticInterpretation("CPI 已納入整體通脹組，不單獨加分，避免與 PCE 重複計算。") },
      { symbol: "CPILFESL", name: "Core CPI", contribution: () => null, interpretation: staticInterpretation("Core CPI 已納入核心通脹組，不單獨加分，避免與 Core PCE 重複計算。") },
      { symbol: "PCEPI", name: "PCE", contribution: () => null, interpretation: staticInterpretation("PCE 已納入整體通脹組，不單獨加分。") },
      { symbol: "PCEPILFE", name: "Core PCE", contribution: () => null, interpretation: staticInterpretation("Core PCE 已納入核心通脹組，不單獨加分。") },
      { symbol: "DCOILWTICO", name: "WTI Crude Oil", contribution: () => null, interpretation: staticInterpretation("原油已納入能源通脹組。") },
      { symbol: "DGS10", name: "10-Year Treasury Yield", contribution: () => null, interpretation: staticInterpretation("10年期美債已納入市場利率組。") },
    ],
  },
  {
    key: "growthScore",
    outputKey: "growth_score",
    nameZh: "增長",
    description: "衡量就業、失業率、初請失業金與職位空缺對經濟增長的影響。",
    factors: [
      { symbol: "UNRATE", name: "Unemployment Rate", contribution: (m) => signContribution(ch90(m, "UNRATE"), -1, 1), interpretation: basicInterpretation("失業率", "失業率下降，支持增長。", "失業率上升，增長轉弱。") },
      { symbol: "ICSA", name: "Initial Claims", contribution: (m) => signContribution(ch30(m, "ICSA"), -1, 1), interpretation: basicInterpretation("初請失業金", "初請下降，就業壓力緩和。", "初請上升，就業壓力增加。") },
      { symbol: "PAYEMS", name: "Nonfarm Payrolls", contribution: (m) => signContribution(ch90(m, "PAYEMS"), 1, -1), interpretation: basicInterpretation("非農就業", "非農上升，支持增長韌性。", "非農下降，增長動能放緩。") },
      { symbol: "JTSJOL", name: "Job Openings", contribution: (m) => signContribution(ch90(m, "JTSJOL"), 1, -1), interpretation: basicInterpretation("職位空缺", "職位空缺上升，勞動需求仍強。", "職位空缺下降，勞動需求放緩。") },
    ],
  },
  {
    key: "riskAppetiteScore",
    outputKey: "risk_appetite_score",
    nameZh: "風險偏好",
    description: "衡量市場是否願意承擔風險，主要看 VIX、信用利差、股指與長端利率。",
    factors: [
      { symbol: "volatilityGroup", name: "波動率組", contribution: (m) => contributionByKey(riskAppetiteContributions(m), "volatilityGroup"), interpretation: staticInterpretation("VIX 是風險偏好的核心信號，權重高於股指 confirmation。") },
      { symbol: "creditRiskGroup", name: "信用利差組", contribution: (m) => contributionByKey(riskAppetiteContributions(m), "creditRiskGroup"), interpretation: staticInterpretation("高收益債利差直接反映信用壓力，權重高於股指 confirmation。") },
      { symbol: "equityConfirmationGroup", name: "股指確認組", contribution: (m) => contributionByKey(riskAppetiteContributions(m), "equityConfirmationGroup"), interpretation: (f) => f.contribution !== null && f.contribution < 0 ? "股指下跌只作為確認信號；美元壓力偏高時，股指負貢獻封頂以避免重複扣分。" : "股指只作為風險偏好的 confirmation，不作為主導項。" },
      { symbol: "VIXCLS", name: "VIX", contribution: () => null, interpretation: staticInterpretation("VIX 已納入波動率組。") },
      { symbol: "BAMLH0A0HYM2", name: "High Yield Spread", contribution: () => null, interpretation: staticInterpretation("高收益債利差已納入信用利差組。") },
      { symbol: "^GSPC", name: "S&P 500", contribution: () => null, interpretation: staticInterpretation("S&P 500 已納入股指確認組，降低權重以避免重複計算美元壓力。") },
      { symbol: "^NDX", name: "Nasdaq 100", contribution: () => null, interpretation: staticInterpretation("Nasdaq 100 已納入股指確認組，降低權重以避免重複計算美元壓力。") },
    ],
  },
  {
    key: "dollarScore",
    outputKey: "dollar_score",
    nameZh: "美元壓力",
    description: "衡量 DXY、美元兌日圓、美元兌離岸人民幣、短端利率與信用利差對美元壓力的影響。",
    factors: [
      { symbol: "DX-Y.NYB", name: "DXY", contribution: (m) => signContribution(ch30(m, "DX-Y.NYB"), 2, -2), interpretation: basicInterpretation("DXY", "DXY 上升，代表美元壓力增加。", "DXY 下降，美元壓力緩和。") },
      { symbol: "JPY=X", name: "USDJPY", contribution: (m) => (ch30(m, "JPY=X") !== null && ch30(m, "JPY=X")! > 0 ? 0.5 : 0), interpretation: basicInterpretation("USDJPY", "USDJPY 上升，反映美元利差或日元壓力。", "USDJPY 未上升，對美元壓力貢獻有限。") },
      { symbol: "CNH=X", name: "USDCNH", contribution: (m) => (ch30(m, "CNH=X") !== null && ch30(m, "CNH=X")! > 0 ? 0.5 : 0), interpretation: basicInterpretation("USDCNH", "USDCNH 上升，人民幣走弱，亞洲資金壓力增加。", "USDCNH 未上升，亞洲美元壓力未擴大。") },
      { symbol: "DGS2", name: "2-Year Treasury Yield", contribution: (m) => signContribution(ch30(m, "DGS2"), 1, -1), interpretation: basicInterpretation("2年期美債", "2年期美債上升，短端美元利率壓力增加。", "2年期美債下降，短端美元壓力緩和。") },
      { symbol: "SOFR", name: "SOFR", contribution: (m) => thresholdContribution(ch30(m, "SOFR"), 0.1, 1, -1), interpretation: basicInterpretation("SOFR", "SOFR上升超過閾值，美元融資壓力增加。", "SOFR下降，美元融資壓力緩和。") },
      { symbol: "BAMLH0A0HYM2", name: "High Yield Spread", contribution: (m) => signContribution(ch30(m, "BAMLH0A0HYM2"), 1, -1), interpretation: basicInterpretation("信用利差", "信用利差擴大，美元融資壓力升高。", "信用利差下降，美元融資壓力緩和。") },
    ],
  },
  {
    key: "creditScore",
    outputKey: "credit_score",
    nameZh: "信用環境",
    description: "衡量高收益債信用利差是否反映金融壓力。",
    factors: [
      { symbol: "BAMLH0A0HYM2", name: "High Yield Spread", contribution: (m) => (signContribution(ch30(m, "BAMLH0A0HYM2"), -2, 2) ?? 0) + (latest(m, "BAMLH0A0HYM2") !== null && latest(m, "BAMLH0A0HYM2")! > 5 ? -1 : 0) + (latest(m, "BAMLH0A0HYM2") !== null && latest(m, "BAMLH0A0HYM2")! < 4 ? 1 : 0), interpretation: basicInterpretation("高收益債利差", "高收益債利差下降或維持低位，信用市場健康。", "高收益債利差擴大或高於壓力區，信用風險升高。") },
    ],
  },
  {
    key: "commodityScore",
    outputKey: "commodity_score",
    nameZh: "商品週期",
    description: "衡量黃金、白銀、銅與原油的商品週期和避險/工業需求變化。",
    factors: [
      { symbol: "growthLedCommodityGroup", name: "工業商品組", contribution: (m) => contributionByKey(commodityContributions(m), "growthLedCommodityGroup"), interpretation: staticInterpretation("商品週期主要由銅與原油確認；兩者同步上升才明確支持商品週期。") },
      { symbol: "preciousMetalsDefensiveSignal", name: "貴金屬防守信號", contribution: () => null, interpretation: staticInterpretation("黃金和白銀偏強可能反映避險或抗通脹需求，不直接加入商品週期分數。") },
      { symbol: "Gold/Silver Ratio", name: "金銀比", contribution: () => null, interpretation: (f) => (f.change30d === null ? "金銀比數據不足。" : f.change30d > 0 ? "金銀比上升，黃金相對白銀轉強，偏避險，不直接推高商品週期分數。" : "金銀比下降，白銀相對黃金轉強，偏風險/週期。") },
      { symbol: "GC=F", name: "Gold Futures", contribution: () => null, interpretation: staticInterpretation("黃金作為貴金屬防守信號觀察，不單獨代表商品週期健康。") },
      { symbol: "SI=F", name: "Silver Futures", contribution: () => null, interpretation: staticInterpretation("白銀作為貴金屬/週期交叉信號觀察，不單獨加入商品週期分數。") },
      { symbol: "HG=F", name: "Copper Futures", contribution: () => null, interpretation: staticInterpretation("銅已納入工業商品組。") },
      { symbol: "DCOILWTICO", name: "WTI Crude Oil", contribution: () => null, interpretation: staticInterpretation("原油已納入工業商品組。") },
    ],
  },
  {
    key: "chinaScore",
    outputKey: "china_score",
    nameZh: "中國宏觀",
    description: "中國宏觀數據尚未接入，暫不參與 regime 判斷。",
    factors: [],
  },
];

export function getScoreBreakdowns(input: { stats: IndicatorStats[]; scores: ScoreLike }): ScoreBreakdown[] {
  const map = new Map(input.stats.filter((item) => isIndicatorActive(item.indicator)).map((item) => [item.indicator.symbol, item]));

  return definitions.map((definition) => {
    const scoreValue = definition.key === "chinaScore" ? null : input.scores[definition.key];
    return {
      key: definition.outputKey,
      nameZh: definition.nameZh,
      score: scoreValue,
      statusLabel: definition.key === "chinaScore" ? "暫無數據" : scoreValue === null ? "數據不足" : scoreValue.toFixed(1),
      description: definition.description,
      factors: definition.factors.map((factor) => {
        const stat = map.get(factor.symbol);
        const values = sortedObservations(stat);
        const derived = factor.symbol === "Gold/Silver Ratio" ? goldSilverFactor(map) : null;
        const contribution = factor.contribution(map);
        const isGroupFactor = isGroupOrSignalFactor(factor.symbol);
        const factorResult: ScoreFactor = {
          symbol: factor.symbol,
          name: factor.name,
          source: stat?.indicator.source ?? (factor.symbol === "Gold/Silver Ratio" ? "DERIVED" : "UNKNOWN"),
          latestValue: derived?.latestValue ?? stat?.latestValue ?? null,
          latestDate: derived?.latestDate ?? latestDate(stat?.latestDate ?? null),
          change3d: derived?.change3d ?? changeFromDays(values, 3),
          change30d: derived?.change30d ?? stat?.change30d ?? null,
          contribution,
          groupContribution: isGroupFactor ? contribution : null,
          factorContribution: isGroupFactor ? null : contribution,
          direction: direction(contribution),
          interpretation: "",
        };
        factorResult.interpretation = factor.interpretation(factorResult);
        return factorResult;
      }),
    };
  });
}
