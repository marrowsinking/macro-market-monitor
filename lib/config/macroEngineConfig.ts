import type {
  FactorFrequency,
  FactorSignalTransform,
  FactorRole,
  ContributionDirection,
  MacroEngineConfig,
  MacroFactorConfig,
  MacroFactorGroupConfig,
  MacroScoreConfig,
  MacroScoreKey,
  ScorePolarity,
  ZScoreWindow,
} from "@/lib/config/macroEngineConfig.types";

type FactorInput = {
  symbol: string;
  name: string;
  source: MacroFactorConfig["source"];
  frequency: FactorFrequency;
  role: FactorRole;
  direction: ContributionDirection;
  scorePolarity: ScorePolarity;
  weight: number;
  preferredZScoreWindows: ZScoreWindow[];
  signalTransform?: FactorSignalTransform;
  transformLookbackDays?: number;
  minObservations?: number;
  normalizationNote?: string;
  description?: string;
  easyModeExplanation: string;
};

type GroupInput = {
  key: string;
  zhName: string;
  enName: string;
  description: string;
  maxContribution: number;
  minContribution: number;
  factors: FactorInput[];
};

type ScoreInput = Omit<MacroScoreConfig, "factorGroups"> & {
  factorGroups: GroupInput[];
};

export const macroScoreKeys: MacroScoreKey[] = [
  "liquidity_score",
  "inflation_score",
  "growth_score",
  "risk_appetite_score",
  "dollar_score",
  "credit_score",
  "commodity_score",
  "china_score",
];

export function getScorePolarityMultiplier(scorePolarity: ScorePolarity): 1 | -1 | 0 {
  switch (scorePolarity) {
    case "higher_increases_score":
      return 1;
    case "higher_decreases_score":
      return -1;
    case "context_dependent":
    case "not_scored":
      return 0;
    default: {
      const exhaustive: never = scorePolarity;
      return exhaustive;
    }
  }
}

type NormalizationMetadata = {
  signalTransform: FactorSignalTransform;
  transformLookbackDays?: number;
  minObservations: number;
  normalizationNote: string;
};

function metadata(
  signalTransform: FactorSignalTransform,
  minObservations: number,
  normalizationNote: string,
  transformLookbackDays?: number,
): NormalizationMetadata {
  return { signalTransform, minObservations, normalizationNote, transformLookbackDays };
}

function normalizationMetadata(input: FactorInput, groupKey: string): NormalizationMetadata {
  if (input.signalTransform && input.minObservations !== undefined && input.normalizationNote) {
    return {
      signalTransform: input.signalTransform,
      transformLookbackDays: input.transformLookbackDays,
      minObservations: input.minObservations,
      normalizationNote: input.normalizationNote,
    };
  }

  if (input.source === "PLACEHOLDER" || input.frequency === "placeholder" || input.direction === "not_scored") {
    return metadata("not_scored", 0, "China macro data is not yet connected and is not scored.");
  }

  if (groupKey === "rate_valuation_pressure" && input.symbol === "DGS10") {
    return metadata("level_change", 30, "Rate changes over a short window capture valuation pressure better than raw level alone.", 30);
  }

  if (groupKey === "defensive_precious_metals" && input.symbol === "GOLD_SILVER_RATIO") {
    return metadata("derived_ratio", 30, "Gold/Silver Ratio is a defensive signal and should not directly push commodity cycle score without context.", 30);
  }

  const bySymbol: Record<string, NormalizationMetadata> = {
    WALCL: metadata("level_change", 20, "Fed balance sheet level is slow-moving; changes over a medium window better capture liquidity impulse.", 90),
    RRPONTSYD: metadata("level", 30, "Reverse repo level reflects idle liquidity parked at the Fed; lower levels are generally more supportive for market liquidity."),
    SOFR: metadata("level", 30, input.symbol === "SOFR" && groupKey === "rate_support" ? "SOFR level reflects short-term dollar funding cost." : "SOFR level reflects short-term funding cost."),
    DGS2: metadata("level", 30, input.symbol === "DGS2" && groupKey === "rate_support" ? "2-year Treasury yield level reflects policy-rate support for the dollar." : "2-year Treasury yield level reflects short-end rate pressure."),
    BAMLH0A0HYM2: metadata("level", 30, groupKey === "high_yield_credit" ? "High yield spread level is the primary proxy for credit conditions." : groupKey === "credit_risk_confirmation" ? "High yield spread level reflects risk appetite through credit stress." : groupKey === "stress_confirmation" ? "Credit stress can confirm broader dollar liquidity pressure." : "High yield spread level acts as a credit and funding stress proxy."),
    CPIAUCSL: metadata("yoy_pct", 18, "CPI is a price index; YoY change is more meaningful than raw level."),
    PCEPI: metadata("yoy_pct", 18, "PCE is a price index; YoY change is more meaningful than raw level."),
    CPILFESL: metadata("yoy_pct", 18, "Core CPI should be evaluated by YoY or annualized change, not raw index level."),
    PCEPILFE: metadata("yoy_pct", 18, "Core PCE is a Fed-relevant inflation measure; YoY change is more meaningful than raw index level."),
    DCOILWTICO: groupKey === "growth_led_commodities"
      ? metadata("pct_change", 30, "Oil 30-day percentage change captures energy commodity momentum.", 30)
      : metadata("pct_change", 30, "Oil is high-frequency; 30-day percentage change captures energy inflation impulse.", 30),
    DGS10: metadata("level", 30, "10-year Treasury yield level acts as market confirmation of inflation/rate pressure."),
    PAYEMS: metadata("mom_change", 18, "Payrolls is a level series; month-over-month change better captures job creation momentum."),
    JTSJOL: metadata("yoy_pct", 18, "Job openings level is slow-moving; YoY change better captures labor demand trend."),
    UNRATE: metadata("level", 18, "Unemployment rate level directly reflects labor market slack."),
    ICSA: metadata("level", 20, "Initial claims level is a timely labor stress indicator."),
    VIXCLS: metadata("level", 30, "VIX level directly reflects equity volatility and market stress."),
    "^GSPC": metadata("pct_change", 30, "Equity index level trends over time; 30-day percentage change is a better confirmation signal.", 30),
    "^NDX": metadata("pct_change", 30, "Nasdaq level trends over time; 30-day percentage change better captures risk appetite momentum.", 30),
    "DX-Y.NYB": metadata("level", 30, "DXY level reflects broad dollar pressure."),
    "JPY=X": metadata("level", 30, "USDJPY level reflects yen pressure and dollar strength."),
    "CNH=X": metadata("level", 30, "USDCNH level reflects offshore yuan pressure and dollar strength."),
    "HG=F": metadata("pct_change", 30, "Copper 30-day percentage change captures industrial commodity momentum.", 30),
    "GC=F": metadata("pct_change", 30, "Gold momentum is context-dependent and may reflect defensive demand rather than commodity cycle strength.", 30),
    "SI=F": metadata("pct_change", 30, "Silver momentum is context-dependent because it contains both industrial and precious-metal characteristics.", 30),
    GOLD_SILVER_RATIO: metadata("derived_ratio", 30, "Gold/Silver Ratio is a defensive signal and should not directly push commodity cycle score without context.", 30),
  };

  const result = bySymbol[input.symbol];
  if (!result) {
    throw new Error(`Missing normalization metadata for factor ${input.symbol} in group ${groupKey}`);
  }
  return result;
}

function group(input: GroupInput): MacroFactorGroupConfig {
  return {
    ...input,
    factors: input.factors.map((item) => {
      const normalized = normalizationMetadata(item, input.key);
      return {
        ...item,
        ...normalized,
        description: item.description ?? item.easyModeExplanation,
      };
    }),
  };
}

function score(input: ScoreInput): MacroScoreConfig {
  return {
    ...input,
    factorGroups: input.factorGroups.map(group),
  };
}

const scores: Record<MacroScoreKey, MacroScoreConfig> = {
  liquidity_score: score({
    key: "liquidity_score",
    zhName: "流動性",
    enName: "Liquidity",
    easyModeSubtitle: "市場資金是否寬鬆",
    professionalDescription: "衡量市場資金條件是否寬鬆，包括央行資產負債表、逆回購、短端融資利率、2年期美債與部分信用條件。",
    methodologyTooltip: "流動性分數不是單純判斷市場有沒有錢，而是觀察央行資產負債表、逆回購、短端融資利率與信用條件是否共同支持市場資金環境。",
    implementationStatus: "current",
    scoreRangeHint: { min: -4.8, max: 4.8, neutral: 0 },
    preferredZScoreWindows: [60, 120, 252],
    factorGroups: [
      {
        key: "central_bank_liquidity",
        zhName: "央行流動性",
        enName: "Central Bank Liquidity",
        description: "觀察 Fed 資產負債表是否提供流動性支持。",
        maxContribution: 1.5,
        minContribution: -1.5,
        factors: [
          { symbol: "WALCL", name: "Fed Balance Sheet", source: "FRED", frequency: "weekly", role: "primary", direction: "higher_is_positive", scorePolarity: "higher_increases_score", weight: 1, preferredZScoreWindows: [252, 365], easyModeExplanation: "Fed 資產負債表上升通常代表流動性支持增加。" },
        ],
      },
      {
        key: "money_market_liquidity",
        zhName: "貨幣市場流動性",
        enName: "Money Market Liquidity",
        description: "觀察逆回購與 SOFR 是否反映貨幣市場資金壓力。",
        maxContribution: 1.5,
        minContribution: -1.5,
        factors: [
          { symbol: "RRPONTSYD", name: "Reverse Repo", source: "FRED", frequency: "daily_rate", role: "primary", direction: "lower_is_positive", scorePolarity: "higher_decreases_score", weight: 0.8, preferredZScoreWindows: [60, 120], easyModeExplanation: "逆回購下降可能代表閒置資金釋放到市場。" },
          { symbol: "SOFR", name: "SOFR", source: "FRED", frequency: "daily_rate", role: "secondary", direction: "lower_is_positive", scorePolarity: "higher_decreases_score", weight: 0.7, preferredZScoreWindows: [60, 120], easyModeExplanation: "SOFR 下降通常代表短端資金壓力緩和。" },
        ],
      },
      {
        key: "rate_pressure",
        zhName: "短端利率壓力",
        enName: "Short Rate Pressure",
        description: "用 2 年期美債觀察短端利率壓力。",
        maxContribution: 1,
        minContribution: -1,
        factors: [
          { symbol: "DGS2", name: "2-Year Treasury Yield", source: "FRED", frequency: "daily_rate", role: "secondary", direction: "lower_is_positive", scorePolarity: "higher_decreases_score", weight: 0.8, preferredZScoreWindows: [60, 120, 252], easyModeExplanation: "2年期美債下降通常代表短端利率壓力緩和。" },
        ],
      },
      {
        key: "credit_liquidity_proxy",
        zhName: "信用流動性代理",
        enName: "Credit Liquidity Proxy",
        description: "用高收益債利差輔助觀察信用融資壓力。",
        maxContribution: 0.8,
        minContribution: -0.8,
        factors: [
          { symbol: "BAMLH0A0HYM2", name: "High Yield Spread", source: "FRED", frequency: "daily_rate", role: "confirmation", direction: "lower_is_positive", scorePolarity: "higher_decreases_score", weight: 0.5, preferredZScoreWindows: [60, 120, 252], easyModeExplanation: "信用利差下降通常代表融資壓力緩和。" },
        ],
      },
    ],
    notes: ["信用利差可輔助判斷流動性壓力，但不應在 liquidity_score 中過高權重，避免與 credit_score 重複。"],
  }),

  inflation_score: score({
    key: "inflation_score",
    zhName: "通脹壓力",
    enName: "Inflation Pressure",
    easyModeSubtitle: "物價和利率壓力",
    professionalDescription: "衡量物價、核心通脹、能源價格與長端利率帶來的通脹壓力。CPI、Core CPI、PCE、Core PCE 屬於高度同源指標，應以 group contribution 避免重複加分。",
    methodologyTooltip: "通脹分數應避免將 CPI、Core CPI、PCE、Core PCE 直接獨立加總。更合理的方式是先分成 headline、core、energy、market rate groups，再合成 inflation_score。",
    implementationStatus: "partial",
    scoreRangeHint: { min: -4.5, max: 4.5, neutral: 0 },
    preferredZScoreWindows: [120, 252],
    factorGroups: [
      {
        key: "headline_inflation",
        zhName: "整體通脹",
        enName: "Headline Inflation",
        description: "合併 CPI 與 PCE，避免同源價格指數重複加分。",
        maxContribution: 1,
        minContribution: -1,
        factors: [
          { symbol: "CPIAUCSL", name: "CPI", source: "FRED", frequency: "monthly_macro", role: "primary", direction: "higher_is_negative", scorePolarity: "higher_increases_score", weight: 0.5, preferredZScoreWindows: [730, 1095], easyModeExplanation: "CPI 上升代表整體物價壓力增加。" },
          { symbol: "PCEPI", name: "PCE", source: "FRED", frequency: "monthly_macro", role: "primary", direction: "higher_is_negative", scorePolarity: "higher_increases_score", weight: 0.5, preferredZScoreWindows: [730, 1095], easyModeExplanation: "PCE 上升代表消費價格壓力增加。" },
        ],
      },
      {
        key: "core_inflation",
        zhName: "核心通脹",
        enName: "Core Inflation",
        description: "合併 Core CPI 與 Core PCE，避免核心通脹同源指標過度疊加。",
        maxContribution: 1.5,
        minContribution: -1.5,
        factors: [
          { symbol: "CPILFESL", name: "Core CPI", source: "FRED", frequency: "monthly_macro", role: "primary", direction: "higher_is_negative", scorePolarity: "higher_increases_score", weight: 0.75, preferredZScoreWindows: [730, 1095], easyModeExplanation: "Core CPI 上升代表較黏性的物價壓力增加。" },
          { symbol: "PCEPILFE", name: "Core PCE", source: "FRED", frequency: "monthly_macro", role: "primary", direction: "higher_is_negative", scorePolarity: "higher_increases_score", weight: 0.75, preferredZScoreWindows: [730, 1095], easyModeExplanation: "Core PCE 上升代表核心消費價格壓力增加。" },
        ],
      },
      {
        key: "energy_inflation",
        zhName: "能源通脹",
        enName: "Energy Inflation",
        description: "用原油觀察能源價格對通脹壓力的推動。",
        maxContribution: 1,
        minContribution: -1,
        factors: [
          { symbol: "DCOILWTICO", name: "WTI Crude Oil", source: "FRED", frequency: "daily_market", role: "secondary", direction: "higher_is_negative", scorePolarity: "higher_increases_score", weight: 1, preferredZScoreWindows: [30, 60, 120], easyModeExplanation: "油價上升可能推高能源通脹壓力。" },
        ],
      },
      {
        key: "market_rate_confirmation",
        zhName: "市場利率確認",
        enName: "Market Rate Confirmation",
        description: "用 10 年期美債確認市場是否重新定價長端利率與通脹風險。",
        maxContribution: 1,
        minContribution: -1,
        factors: [
          { symbol: "DGS10", name: "10-Year Treasury Yield", source: "FRED", frequency: "daily_rate", role: "confirmation", direction: "higher_is_negative", scorePolarity: "higher_increases_score", weight: 0.8, preferredZScoreWindows: [60, 120, 252], easyModeExplanation: "10年期美債上升通常代表長端利率或通脹風險被重新定價。" },
        ],
      },
    ],
    notes: ["月度通脹數據不應一律使用 30 日 z-score。", "未來應加入 YoY、3-month annualized、surprise vs consensus、breakeven inflation、inflation expectations。"],
  }),

  growth_score: score({
    key: "growth_score",
    zhName: "增長",
    enName: "Growth",
    easyModeSubtitle: "經濟增長是否有支撐",
    professionalDescription: "衡量就業、失業、初請失業金與職位空缺反映的經濟增長狀態。",
    methodologyTooltip: "增長分數用來觀察經濟是否仍有基本面支撐，而不是單純看股市漲跌。",
    implementationStatus: "current",
    scoreRangeHint: { min: -3, max: 3, neutral: 0 },
    preferredZScoreWindows: [60, 120, 252],
    factorGroups: [
      {
        key: "labor_demand",
        zhName: "勞動需求",
        enName: "Labor Demand",
        description: "用非農就業與職位空缺觀察勞動需求。",
        maxContribution: 1.5,
        minContribution: -1.5,
        factors: [
          { symbol: "PAYEMS", name: "Nonfarm Payrolls", source: "FRED", frequency: "monthly_macro", role: "primary", direction: "higher_is_positive", scorePolarity: "higher_increases_score", weight: 0.8, preferredZScoreWindows: [730, 1095], easyModeExplanation: "非農就業上升通常代表就業需求仍有支撐。" },
          { symbol: "JTSJOL", name: "Job Openings", source: "FRED", frequency: "monthly_macro", role: "secondary", direction: "higher_is_positive", scorePolarity: "higher_increases_score", weight: 0.7, preferredZScoreWindows: [730, 1095], easyModeExplanation: "職位空缺上升通常代表企業招聘需求較強。" },
        ],
      },
      {
        key: "labor_stress",
        zhName: "勞動市場壓力",
        enName: "Labor Market Stress",
        description: "用失業率與初請失業金觀察勞動市場壓力。",
        maxContribution: 1.5,
        minContribution: -1.5,
        factors: [
          { symbol: "UNRATE", name: "Unemployment Rate", source: "FRED", frequency: "monthly_macro", role: "primary", direction: "lower_is_positive", scorePolarity: "higher_decreases_score", weight: 0.8, preferredZScoreWindows: [730, 1095], easyModeExplanation: "失業率下降通常代表勞動市場更穩。" },
          { symbol: "ICSA", name: "Initial Claims", source: "FRED", frequency: "weekly", role: "primary", direction: "lower_is_positive", scorePolarity: "higher_decreases_score", weight: 0.8, preferredZScoreWindows: [252, 365], easyModeExplanation: "初請失業金下降通常代表就業壓力緩和。" },
        ],
      },
    ],
    notes: ["增長分數應避免被單一就業數據過度主導。", "未來可加入 ISM、PMI、retail sales、industrial production。"],
  }),

  risk_appetite_score: score({
    key: "risk_appetite_score",
    zhName: "風險偏好",
    enName: "Risk Appetite",
    easyModeSubtitle: "市場是否願意冒險",
    professionalDescription: "衡量市場是否願意承擔風險。VIX 與信用利差應是核心，股指是 confirmation signal，不應過度主導。",
    methodologyTooltip: "risk_appetite_score 與 dollar_score 可能高度相關，因此需要避免美元走強導致股市下跌時，把同一條壓力重複計入兩次。",
    implementationStatus: "partial",
    scoreRangeHint: { min: -4.8, max: 4.8, neutral: 0 },
    preferredZScoreWindows: [30, 60, 120],
    factorGroups: [
      {
        key: "volatility_stress",
        zhName: "波動率壓力",
        enName: "Volatility Stress",
        description: "用 VIX 觀察市場波動率壓力。",
        maxContribution: 1.5,
        minContribution: -1.5,
        factors: [
          { symbol: "VIXCLS", name: "VIX", source: "FRED", frequency: "daily_market", role: "primary", direction: "lower_is_positive", scorePolarity: "higher_decreases_score", weight: 1, preferredZScoreWindows: [30, 60, 120], easyModeExplanation: "VIX 下降通常代表市場恐慌下降，風險偏好改善。" },
        ],
      },
      {
        key: "credit_risk_confirmation",
        zhName: "信用風險確認",
        enName: "Credit Risk Confirmation",
        description: "用高收益債利差確認信用市場是否支持風險偏好。",
        maxContribution: 1.5,
        minContribution: -1.5,
        factors: [
          { symbol: "BAMLH0A0HYM2", name: "High Yield Spread", source: "FRED", frequency: "daily_rate", role: "primary", direction: "lower_is_positive", scorePolarity: "higher_decreases_score", weight: 1, preferredZScoreWindows: [60, 120, 252], easyModeExplanation: "高收益債利差下降通常代表信用壓力緩和，市場更願意承擔風險。" },
        ],
      },
      {
        key: "equity_confirmation",
        zhName: "股指確認",
        enName: "Equity Confirmation",
        description: "用 S&P 500 與 Nasdaq 100 作為風險偏好的確認信號。",
        maxContribution: 1,
        minContribution: -1,
        factors: [
          { symbol: "^GSPC", name: "S&P 500", source: "YAHOO", frequency: "daily_market", role: "confirmation", direction: "higher_is_positive", scorePolarity: "higher_increases_score", weight: 0.5, preferredZScoreWindows: [30, 60, 120], easyModeExplanation: "S&P 500 上升通常代表市場願意承擔風險。" },
          { symbol: "^NDX", name: "Nasdaq 100", source: "YAHOO", frequency: "daily_market", role: "confirmation", direction: "higher_is_positive", scorePolarity: "higher_increases_score", weight: 0.5, preferredZScoreWindows: [30, 60, 120], easyModeExplanation: "Nasdaq 100 上升通常代表成長股風險偏好改善。" },
        ],
      },
      {
        key: "rate_valuation_pressure",
        zhName: "利率估值壓力",
        enName: "Rate Valuation Pressure",
        description: "用 10 年期美債觀察長端利率對估值的壓力。",
        maxContribution: 0.8,
        minContribution: -0.8,
        factors: [
          { symbol: "DGS10", name: "10-Year Treasury Yield", source: "FRED", frequency: "daily_rate", role: "secondary", direction: "lower_is_positive", scorePolarity: "higher_decreases_score", weight: 0.5, preferredZScoreWindows: [60, 120, 252], easyModeExplanation: "10年期美債下降通常降低估值壓力。" },
        ],
      },
    ],
    notes: ["當 dollar_score 很高時，股指下跌可能反映美元壓力，不應在 risk_appetite_score 中重複過度扣分。", "未來 scoreEngine v2 應加入 double-counting control。"],
  }),

  dollar_score: score({
    key: "dollar_score",
    zhName: "美元壓力",
    enName: "Dollar Pressure",
    easyModeSubtitle: "美元是否偏強",
    professionalDescription: "衡量美元與全球美元流動性壓力，包括 DXY、USDJPY、USDCNH、2年期美債、SOFR 與信用利差。",
    methodologyTooltip: "美元壓力不是單純看美元升跌，而是觀察全球美元流動性壓力，以及非美貨幣和美元融資市場是否同時承壓。",
    implementationStatus: "current",
    scoreRangeHint: { min: -4.8, max: 4.8, neutral: 0 },
    preferredZScoreWindows: [30, 60, 120],
    factorGroups: [
      {
        key: "broad_dollar",
        zhName: "廣義美元",
        enName: "Broad Dollar",
        description: "用 DXY 觀察美元相對主要貨幣的一籃子壓力。",
        maxContribution: 2,
        minContribution: -2,
        factors: [
          { symbol: "DX-Y.NYB", name: "DXY", source: "YAHOO", frequency: "daily_market", role: "primary", direction: "higher_is_negative", scorePolarity: "higher_increases_score", weight: 1, preferredZScoreWindows: [30, 60, 120], easyModeExplanation: "DXY 上升通常代表美元壓力增加。" },
        ],
      },
      {
        key: "fx_pressure",
        zhName: "非美貨幣壓力",
        enName: "FX Pressure",
        description: "用 USDJPY 與 USDCNH 觀察非美貨幣壓力。",
        maxContribution: 1.5,
        minContribution: -1.5,
        factors: [
          { symbol: "JPY=X", name: "USDJPY", source: "YAHOO", frequency: "daily_market", role: "secondary", direction: "higher_is_negative", scorePolarity: "higher_increases_score", weight: 0.75, preferredZScoreWindows: [30, 60, 120], easyModeExplanation: "USDJPY 上升可能代表日圓承壓或美元利差壓力增加。" },
          { symbol: "CNH=X", name: "USDCNH", source: "YAHOO", frequency: "daily_market", role: "secondary", direction: "higher_is_negative", scorePolarity: "higher_increases_score", weight: 0.75, preferredZScoreWindows: [30, 60, 120], easyModeExplanation: "USDCNH 上升可能代表離岸人民幣承壓，亞洲美元壓力增加。" },
        ],
      },
      {
        key: "rate_support",
        zhName: "利率支撐",
        enName: "Rate Support",
        description: "用 2 年期美債與 SOFR 觀察美元利率支撐。",
        maxContribution: 1,
        minContribution: -1,
        factors: [
          { symbol: "DGS2", name: "2-Year Treasury Yield", source: "FRED", frequency: "daily_rate", role: "confirmation", direction: "higher_is_negative", scorePolarity: "higher_increases_score", weight: 0.6, preferredZScoreWindows: [60, 120, 252], easyModeExplanation: "2年期美債上升通常增加美元利率吸引力和資金成本。" },
          { symbol: "SOFR", name: "SOFR", source: "FRED", frequency: "daily_rate", role: "confirmation", direction: "higher_is_negative", scorePolarity: "higher_increases_score", weight: 0.4, preferredZScoreWindows: [60, 120], easyModeExplanation: "SOFR 上升通常代表美元短端融資壓力增加。" },
        ],
      },
      {
        key: "stress_confirmation",
        zhName: "壓力確認",
        enName: "Stress Confirmation",
        description: "用高收益債利差確認美元壓力是否伴隨信用壓力。",
        maxContribution: 0.8,
        minContribution: -0.8,
        factors: [
          { symbol: "BAMLH0A0HYM2", name: "High Yield Spread", source: "FRED", frequency: "daily_rate", role: "confirmation", direction: "higher_is_negative", scorePolarity: "higher_increases_score", weight: 0.5, preferredZScoreWindows: [60, 120, 252], easyModeExplanation: "信用利差擴大通常代表美元融資壓力或市場壓力升高。" },
        ],
      },
    ],
    notes: ["dollar_score 代表美元壓力，不代表投資建議。", "高美元壓力可能壓制商品、新興市場與風險資產。"],
  }),

  credit_score: score({
    key: "credit_score",
    zhName: "信用環境",
    enName: "Credit Conditions",
    easyModeSubtitle: "信用市場是否健康",
    professionalDescription: "衡量信用利差是否反映信用市場健康或壓力。",
    methodologyTooltip: "信用環境用來觀察市場對企業融資與信用風險的定價，目前主要使用 High Yield Spread。",
    implementationStatus: "current",
    scoreRangeHint: { min: -3, max: 3, neutral: 0 },
    preferredZScoreWindows: [60, 120, 252],
    factorGroups: [
      {
        key: "high_yield_credit",
        zhName: "高收益信用利差",
        enName: "High Yield Credit Spread",
        description: "用高收益債利差觀察信用環境。",
        maxContribution: 3,
        minContribution: -3,
        factors: [
          { symbol: "BAMLH0A0HYM2", name: "High Yield Spread", source: "FRED", frequency: "daily_rate", role: "primary", direction: "lower_is_positive", scorePolarity: "higher_decreases_score", weight: 1, preferredZScoreWindows: [60, 120, 252], easyModeExplanation: "高收益債利差下降通常代表信用環境改善。" },
        ],
      },
    ],
    notes: ["目前主要使用 High Yield Spread。", "未來可加入 investment grade spread、HYG、LQD、default rate。"],
  }),

  commodity_score: score({
    key: "commodity_score",
    zhName: "商品週期",
    enName: "Commodity Cycle",
    easyModeSubtitle: "商品價格是否支持周期",
    professionalDescription: "衡量 growth-led commodities 是否支持商品週期。銅和原油更能反映工業需求與能源需求；黃金、白銀與金銀比更偏 defensive precious metals signal。",
    methodologyTooltip: "商品週期應區分成長型商品與防守型貴金屬。Gold 上升不一定代表商品週期健康，Gold/Silver Ratio 上升更可能是 defensive signal。",
    implementationStatus: "partial",
    scoreRangeHint: { min: -2.5, max: 2.5, neutral: 0 },
    preferredZScoreWindows: [30, 60, 120],
    factorGroups: [
      {
        key: "growth_led_commodities",
        zhName: "成長型商品",
        enName: "Growth-led Commodities",
        description: "用銅與原油確認工業需求和能源需求是否支持商品週期。",
        maxContribution: 2,
        minContribution: -2,
        factors: [
          { symbol: "HG=F", name: "Copper Futures", source: "YAHOO", frequency: "daily_market", role: "primary", direction: "higher_is_positive", scorePolarity: "higher_increases_score", weight: 1, preferredZScoreWindows: [30, 60, 120], easyModeExplanation: "銅價上升通常代表工業需求或周期交易改善。" },
          { symbol: "DCOILWTICO", name: "WTI Crude Oil", source: "FRED", frequency: "daily_market", role: "primary", direction: "higher_is_positive", scorePolarity: "higher_increases_score", weight: 1, preferredZScoreWindows: [30, 60, 120], easyModeExplanation: "油價上升通常代表能源需求或再通脹壓力增加。" },
        ],
      },
      {
        key: "defensive_precious_metals",
        zhName: "防守型貴金屬",
        enName: "Defensive Precious Metals",
        description: "用黃金、白銀與金銀比觀察防守、避險或抗通脹需求。",
        maxContribution: 0.5,
        minContribution: -0.5,
        factors: [
          { symbol: "GC=F", name: "Gold Futures", source: "YAHOO", frequency: "daily_market", role: "defensive", direction: "context_dependent", scorePolarity: "context_dependent", weight: 0.3, preferredZScoreWindows: [30, 60, 120], easyModeExplanation: "黃金上升可能代表避險、抗通脹或實質利率下降，不一定代表商品週期健康。" },
          { symbol: "SI=F", name: "Silver Futures", source: "YAHOO", frequency: "daily_market", role: "defensive", direction: "context_dependent", scorePolarity: "context_dependent", weight: 0.3, preferredZScoreWindows: [30, 60, 120], easyModeExplanation: "白銀同時有貴金屬與工業屬性，需要結合黃金和銅一起觀察。" },
          { symbol: "GOLD_SILVER_RATIO", name: "Gold/Silver Ratio", source: "DERIVED", frequency: "derived", role: "defensive", direction: "context_dependent", scorePolarity: "context_dependent", weight: 0.3, preferredZScoreWindows: [30, 60, 120], easyModeExplanation: "金銀比上升通常偏防守，可能代表白銀相對弱或工業需求不足。" },
        ],
      },
    ],
    notes: ["Gold 上升不一定代表商品週期健康。", "Gold/Silver Ratio 上升更可能是 defensive signal 或 conflicting signal。", "商品週期應以 Copper + Oil 同步確認為核心。"],
  }),

  china_score: score({
    key: "china_score",
    zhName: "中國宏觀",
    enName: "China Macro",
    easyModeSubtitle: "中國宏觀數據狀態",
    professionalDescription: "中國宏觀數據尚未完整接入，目前只作未來擴展維度，不參與主要 regime 判斷。",
    methodologyTooltip: "中國宏觀目前是 placeholder，未完整接入前不應主導 confirmedRegime 或 score 判斷。",
    implementationStatus: "placeholder",
    scoreRangeHint: { min: 0, max: 0, neutral: 0 },
    preferredZScoreWindows: [],
    factorGroups: [
      {
        key: "china_placeholder",
        zhName: "中國宏觀佔位",
        enName: "China Macro Placeholder",
        description: "中國宏觀資料尚未完整接入，保留為後續擴展。",
        maxContribution: 0,
        minContribution: 0,
        factors: ["CHINA_M2", "CHINA_TSF", "CHINA_PMI", "CHINA_PPI", "CSI300", "HSTECH"].map((symbol) => ({
          symbol,
          name: symbol,
          source: "PLACEHOLDER",
          frequency: "placeholder",
          role: "placeholder",
          direction: "not_scored",
          scorePolarity: "not_scored",
          weight: 0,
          preferredZScoreWindows: [],
          easyModeExplanation: "中國宏觀數據尚未完整接入。",
        })),
      },
    ],
    notes: ["中國數據目前不參與主要 regime 判斷。", "未來可接入 M2、TSF、PMI、PPI、CSI 300、HS Tech 等。"],
  }),
};

export const macroEngineConfig: MacroEngineConfig = {
  version: "v1-methodology-config",
  description: "Shared macro score methodology configuration for dashboard, methodology page, tooltips and future shadow score engine.",
  scores,
};

export function getMacroScoreConfig(key: MacroScoreKey): MacroScoreConfig {
  const config = macroEngineConfig.scores[key];
  if (!config) {
    throw new Error(`Unknown macro score config key: ${key}`);
  }
  return config;
}

export function getAllMacroScoreConfigs(): MacroScoreConfig[] {
  return macroScoreKeys.map(getMacroScoreConfig);
}

export function getAllFactorsForScore(scoreKey: MacroScoreKey): MacroFactorConfig[] {
  return getMacroScoreConfig(scoreKey).factorGroups.flatMap((group) => group.factors);
}

export function getAllConfiguredFactors(): MacroFactorConfig[] {
  return getAllMacroScoreConfigs().flatMap((scoreConfig) => scoreConfig.factorGroups.flatMap((group) => group.factors));
}
