type RegimeLike = {
  finalRegime: string;
  liquidityScore: number;
  inflationScore: number;
  growthScore: number;
  riskAppetiteScore: number;
  dollarScore: number;
  creditScore: number;
  commodityScore: number;
  chinaScore: number;
};

type ScoreChange = {
  previous: number | null;
  current: number;
  change: number | null;
};

type ScoreChanges = {
  liquidityScore: ScoreChange;
  inflationScore: ScoreChange;
  growthScore: ScoreChange;
  riskAppetiteScore: ScoreChange;
  dollarScore: ScoreChange;
  creditScore: ScoreChange;
  commodityScore: ScoreChange;
  chinaScore: ScoreChange;
};

type ConfirmedRegimeStateLike = {
  confirmedRegime: string;
  rawRegimeSignal: string;
  previousConfirmedRegime: string | null;
  regimeChanged: boolean;
  pendingRegime: string | null;
  pendingConfirmationDays: number;
  requiredConfirmationDays: number;
  daysInConfirmedRegime: number;
  confidence: "high" | "medium" | "low";
  explanation: string;
};

export type ResearchNarrativeTone = "risk_on" | "risk_off" | "mixed" | "inflation" | "tight_liquidity";

export type ResearchNarrativeInput = {
  latestRegime: RegimeLike | null;
  previousRegime?: RegimeLike | null;
  confirmedRegimeState?: ConfirmedRegimeStateLike;
  scoreChanges?: ScoreChanges;
  keyDrivers?: string[];
  conflictingSignals?: string[];
  watchNext?: string[];
  regimeHistorySummary?: string | null;
};

export type ResearchNarrative = {
  headline: string;
  conclusion: string;
  importantChange: string | null;
  why: string[];
  changes: string[];
  conflicts: string[];
  watchNext: string[];
  tone: ResearchNarrativeTone;
};

function score(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "暫無";
  return value.toFixed(1);
}

function delta(current: number, previous: number): number {
  return Number((current - previous).toFixed(2));
}

function signed(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function plainScore(value: number): string {
  return value === 0 ? "0.0" : signed(value);
}

function limit(items: string[], max: number): string[] {
  return items.filter(Boolean).slice(0, max);
}

function toneForRegime(regime: RegimeLike | null): ResearchNarrativeTone {
  if (!regime) return "mixed";
  if (regime.finalRegime.includes("避險") || regime.finalRegime.includes("衰退")) return "risk_off";
  if (regime.finalRegime.includes("再通脹") || regime.inflationScore >= 3) return "inflation";
  if (regime.finalRegime.includes("美元") || regime.liquidityScore <= -2) return "tight_liquidity";
  if (regime.finalRegime.includes("風險偏好")) return "risk_on";
  return "mixed";
}

function conclusionFor(regime: RegimeLike | null): string {
  if (!regime) return "目前尚未生成足夠的宏觀狀態資料，暫時不適合給出方向性結論。";

  if (regime.finalRegime === "風險偏好模式") {
    const caveat = regime.dollarScore >= 1 || regime.inflationScore >= 3 ? "但這不是完全乾淨 risk-on，美元壓力或通脹分數仍可能限制估值擴張。" : "目前風險資產和信用市場給出的信號較一致。";
    return `今日系統判斷為風險偏好模式。風險資產與信用市場仍然支持市場承擔風險，${caveat}`;
  }

  if (regime.finalRegime === "高利率風險偏好環境") {
    return "今日系統判斷為高利率風險偏好環境。風險資產和信用市場表現仍強，但利率、美元和通脹壓力沒有消失，這種環境對估值較高的資產更敏感。";
  }

  if (regime.finalRegime === "再通脹交易") {
    return "今日系統判斷為再通脹交易。通脹壓力由核心通脹、能源價格或長端利率共同推動，市場正在重新定價名目增長和利率壓力，長久期資產相對容易承壓。";
  }

  if (regime.finalRegime === "衰退降息交易") {
    return "今日系統判斷為衰退降息交易。增長信號轉弱且短端利率下行，市場更偏向押注未來降息，但股票仍需要面對盈利下修風險。";
  }

  if (regime.finalRegime === "避險模式") {
    return "今日系統判斷為避險模式。波動率、信用利差或美元壓力顯示資金正在轉向防守，風險資產需要先等待壓力緩和。";
  }

  if (regime.finalRegime === "混合震盪模式") {
    return "今日系統判斷為混合震盪模式。指標之間仍然互相矛盾，目前不宜給出過強方向性結論，應等待美元、利率和信用利差確認。";
  }

  return `今日系統判斷為${regime.finalRegime}。目前市場主線需要結合風險偏好、流動性、通脹和信用信號一起觀察。`;
}

function headlineFor(regime: RegimeLike | null): string {
  if (!regime) return "資料不足，暫不給方向";
  if (regime.finalRegime === "風險偏好模式") {
    return regime.dollarScore >= 1 || regime.inflationScore >= 3 ? "風險偏好模式，但不是乾淨的 risk-on" : "風險偏好模式，風險資產信號較一致";
  }
  if (regime.finalRegime === "高利率風險偏好環境") return "高利率下的風險偏好，對美元和利率更敏感";
  if (regime.finalRegime === "再通脹交易") return "再通脹壓力回升，長端利率和商品是主線";
  if (regime.finalRegime === "衰退降息交易") return "增長轉弱，市場開始交易降息預期";
  if (regime.finalRegime === "避險模式") return "避險壓力升高，市場轉向防守";
  if (regime.finalRegime === "混合震盪模式") return "信號互相矛盾，暫不給強方向";
  return `${regime.finalRegime}，等待關鍵市場信號確認`;
}

function whyFor(regime: RegimeLike | null, keyDrivers: string[]): string[] {
  if (!regime) return ["目前缺少最新 MacroRegime，無法拆解主要判斷依據。"];

  const items = [
    `risk_appetite_score 為 ${score(regime.riskAppetiteScore)}，代表風險偏好目前${regime.riskAppetiteScore >= 2 ? "偏強" : regime.riskAppetiteScore <= -2 ? "偏弱" : "不算明確"}。`,
    `credit_score 為 ${score(regime.creditScore)}，代表信用市場${regime.creditScore >= 2 ? "暫時健康" : regime.creditScore <= -1 ? "壓力升高" : "信號中性"}。`,
  ];

  if (regime.liquidityScore < 0) items.push(`liquidity_score 為 ${score(regime.liquidityScore)}，說明流動性條件並不寬鬆。`);
  if (regime.dollarScore >= 1) items.push(`dollar_score 為 ${score(regime.dollarScore)}，美元或融資壓力仍是限制因素。`);
  if (regime.inflationScore >= 3) items.push(`inflation_score 為 ${score(regime.inflationScore)}，通脹壓力由核心通脹、能源價格或長端利率共同推動。`);
  if (regime.commodityScore < 0) items.push(`commodity_score 為 ${score(regime.commodityScore)}，商品端沒有配合，銅和原油未確認商品週期改善。`);

  return limit([...items, ...keyDrivers], 4);
}

const scoreChangeLabels: Record<keyof ScoreChanges, { key: string; meaning: (change: number) => string }> = {
  liquidityScore: {
    key: "liquidity_score",
    meaning: (change) => `代表流動性條件${change > 0 ? "改善" : "轉弱"}。`,
  },
  inflationScore: {
    key: "inflation_score",
    meaning: (change) => `代表通脹壓力${change > 0 ? "升高" : "降溫"}。`,
  },
  growthScore: {
    key: "growth_score",
    meaning: (change) => `代表增長信號${change > 0 ? "改善" : "轉弱"}。`,
  },
  riskAppetiteScore: {
    key: "risk_appetite_score",
    meaning: (change) => `代表風險偏好${change > 0 ? "明顯改善" : "明顯降溫"}。`,
  },
  dollarScore: {
    key: "dollar_score",
    meaning: (change) => `代表美元壓力${change > 0 ? "進一步升高" : "有所緩和"}。`,
  },
  creditScore: {
    key: "credit_score",
    meaning: (change) => `代表信用環境${change > 0 ? "改善" : "轉弱"}。`,
  },
  commodityScore: {
    key: "commodity_score",
    meaning: (change) => `代表商品週期${change > 0 ? "轉強" : "轉弱"}。`,
  },
  chinaScore: {
    key: "china_score",
    meaning: () => "中國宏觀數據尚未接入，暫不作主要判斷。",
  },
};

const scoreChangeNames: Record<keyof ScoreChanges, string> = {
  liquidityScore: "流動性",
  inflationScore: "通脹壓力",
  growthScore: "增長",
  riskAppetiteScore: "風險偏好",
  dollarScore: "美元壓力",
  creditScore: "信用環境",
  commodityScore: "商品週期",
  chinaScore: "中國宏觀",
};

function movementPhrase(name: string, previous: number, current: number, change: number): string {
  if (change > 0) return `${name}由 ${plainScore(previous)} 升至 ${plainScore(current)}`;
  if (current < previous && current < 0 && previous < 0) return `${name}由 ${plainScore(previous)} 進一步降至 ${plainScore(current)}`;
  if (current < previous && current >= 0 && previous > 0) return `${name}由 ${plainScore(previous)} 回落至 ${plainScore(current)}`;
  return `${name}由 ${plainScore(previous)} 降至 ${plainScore(current)}`;
}

function joinClauses(clauses: string[]): string {
  if (clauses.length <= 1) return clauses.join("");
  if (clauses.length === 2) return `${clauses[0]}，但${clauses[1]}`;
  return `${clauses.slice(0, -1).join("，")}，但${clauses[clauses.length - 1]}`;
}

function importantChangeFor(regime: RegimeLike | null, previous: RegimeLike | null | undefined, scoreChanges?: ScoreChanges): string | null {
  if (!regime || !previous || !scoreChanges) return null;

  const clauses = (Object.entries(scoreChanges) as Array<[keyof ScoreChanges, ScoreChange]>)
    .filter(([, value]) => value.previous !== null && value.change !== null && value.change !== 0)
    .sort((a, b) => Math.abs(b[1].change ?? 0) - Math.abs(a[1].change ?? 0))
    .slice(0, 3)
    .map(([key, value]) => movementPhrase(scoreChangeNames[key], value.previous ?? 0, value.current, value.change ?? 0));

  if (clauses.length === 0) return null;
  const prefix = previous.finalRegime !== regime.finalRegime ? "Regime 切換主因：" : "今日最重要變化：";
  return `${prefix}${joinClauses(clauses)}。`;
}

function majorScoreChangeItems(scoreChanges: ScoreChanges | undefined): string[] {
  if (!scoreChanges) return [];
  return (Object.entries(scoreChanges) as Array<[keyof ScoreChanges, ScoreChange]>)
    .filter(([, value]) => value.change !== null && Math.abs(value.change) >= 0.5)
    .sort((a, b) => Math.abs(b[1].change ?? 0) - Math.abs(a[1].change ?? 0))
    .slice(0, 4)
    .map(([key, value]) => {
      const meta = scoreChangeLabels[key];
      const change = value.change ?? 0;
      return `${meta.key}: ${signed(value.previous ?? 0)} → ${signed(value.current)}，${meta.meaning(change)}`;
    });
}

function changesFor(
  regime: RegimeLike | null,
  previous: RegimeLike | null | undefined,
  historySummary?: string | null,
  scoreChanges?: ScoreChanges,
  confirmedState?: ConfirmedRegimeStateLike,
): string[] {
  if (!regime) return ["目前沒有最新 regime，暫無可比較變化。"];
  if (!previous) return [historySummary ?? "暫無上一筆 MacroRegime，先以今日狀態作為觀察基準。"];

  const items: string[] = [];
  if (confirmedState?.regimeChanged && confirmedState.previousConfirmedRegime) {
    items.push(`已確認 regime 從「${confirmedState.previousConfirmedRegime}」轉為「${confirmedState.confirmedRegime}」。`);
  } else if (confirmedState && confirmedState.rawRegimeSignal !== confirmedState.confirmedRegime) {
    items.push(`今日信號指向「${confirmedState.rawRegimeSignal}」，但正式 regime 仍維持「${confirmedState.confirmedRegime}」，目前確認中。`);
  } else if (previous.finalRegime !== regime.finalRegime) {
    items.push(`已確認 regime 從「${previous.finalRegime}」轉為「${regime.finalRegime}」。`);
  } else {
    items.push("已確認 regime 未變，代表目前狀態仍在延續。");
  }

  const majorItems = majorScoreChangeItems(scoreChanges);
  if (majorItems.length > 0) {
    items.push("主要分數變化：");
    items.push(...majorItems);
    return limit(items, 6);
  }

  const liquidityDelta = delta(regime.liquidityScore, previous.liquidityScore);
  const commodityDelta = delta(regime.commodityScore, previous.commodityScore);
  const dollarDelta = delta(regime.dollarScore, previous.dollarScore);
  const riskDelta = delta(regime.riskAppetiteScore, previous.riskAppetiteScore);

  if (previous.liquidityScore < 0 && regime.liquidityScore >= 0) items.push("流動性分數由負轉正，流動性條件改善。");
  if (commodityDelta <= -1 || regime.commodityScore < 0) items.push("商品分數偏弱或明顯下降，商品端沒有配合，銅和原油未確認商品週期改善。");
  if (regime.dollarScore >= 1 && dollarDelta >= 0) items.push("美元壓力仍在高位，是當前市場的限制因素。");
  if (Math.abs(riskDelta) >= 1) items.push(`風險偏好分數變化 ${riskDelta > 0 ? "+" : ""}${riskDelta.toFixed(1)}，代表風險資產信號有所${riskDelta > 0 ? "改善" : "降溫"}。`);
  if (Math.abs(liquidityDelta) >= 1 && !(previous.liquidityScore < 0 && regime.liquidityScore >= 0)) items.push(`流動性分數變化 ${liquidityDelta > 0 ? "+" : ""}${liquidityDelta.toFixed(1)}。`);

  return limit(items, 4);
}

function conflictsFor(regime: RegimeLike | null, conflictingSignals: string[]): string[] {
  if (!regime) return ["資料不足，暫時無法判斷矛盾信號。"];

  const items = [...conflictingSignals];
  if (regime.dollarScore >= 1) items.push("dollar_score 仍然偏高，代表風險偏好不是由全面寬鬆驅動。");
  if (regime.dollarScore >= 3 && regime.riskAppetiteScore < 0) items.push("美元壓力與風險偏好可能來自同一條全球流動性收緊主線，需避免重複解讀。");
  if (regime.inflationScore >= 3) items.push("inflation_score 仍然高，長端利率或通脹數據可能重新壓制估值。");
  if (regime.commodityScore < 0) items.push("commodityScore 為負，商品端沒有配合，銅和原油未確認商品週期改善；若黃金偏強，可能更多是避險或抗通脹需求。");
  if (items.length === 0) items.push("目前矛盾信號不算突出，但仍需觀察美元、利率和信用利差是否同步。");
  return limit(items, 4);
}

export function generateResearchNarrative(input: ResearchNarrativeInput): ResearchNarrative {
  const latest = input.latestRegime;
  const watch = input.watchNext?.length ? input.watchNext : ["DXY 是否繼續上升。", "10Y 美債收益率是否重新上行。", "VIX 是否反彈。", "信用利差是否擴大。"];

  return {
    headline: headlineFor(latest),
    conclusion: conclusionFor(latest),
    importantChange: importantChangeFor(latest, input.previousRegime, input.scoreChanges),
    why: whyFor(latest, input.keyDrivers ?? []),
    changes: changesFor(latest, input.previousRegime, input.regimeHistorySummary, input.scoreChanges, input.confirmedRegimeState),
    conflicts: conflictsFor(latest, input.conflictingSignals ?? []),
    watchNext: limit(watch, 5),
    tone: toneForRegime(latest),
  };
}
