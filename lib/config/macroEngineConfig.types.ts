export type MacroScoreKey =
  | "liquidity_score"
  | "inflation_score"
  | "growth_score"
  | "risk_appetite_score"
  | "dollar_score"
  | "credit_score"
  | "commodity_score"
  | "china_score";

export type FactorFrequency =
  | "daily_market"
  | "daily_rate"
  | "weekly"
  | "monthly_macro"
  | "derived"
  | "placeholder";

export type FactorRole =
  | "primary"
  | "secondary"
  | "confirmation"
  | "defensive"
  | "conflicting"
  | "placeholder";

export type ContributionDirection =
  | "higher_is_positive"
  | "higher_is_negative"
  | "lower_is_positive"
  | "lower_is_negative"
  | "context_dependent"
  | "not_scored";

export type ScorePolarity =
  | "higher_increases_score"
  | "higher_decreases_score"
  | "context_dependent"
  | "not_scored";

export type FactorSignalTransform =
  | "level"
  | "level_change"
  | "pct_change"
  | "yoy_pct"
  | "mom_change"
  | "mom_pct"
  | "derived_ratio"
  | "not_scored";

export type ImplementationStatus =
  | "current"
  | "partial"
  | "planned"
  | "placeholder";

export type ZScoreWindow = 30 | 60 | 90 | 120 | 252 | 365 | 540 | 730 | 1095;

export type MacroFactorConfig = {
  symbol: string;
  name: string;
  source?: "FRED" | "YAHOO" | "DERIVED" | "PLACEHOLDER";
  frequency: FactorFrequency;
  role: FactorRole;
  direction: ContributionDirection;
  scorePolarity: ScorePolarity;
  weight: number;
  preferredZScoreWindows: ZScoreWindow[];
  signalTransform: FactorSignalTransform;
  transformLookbackDays?: number;
  minObservations: number;
  normalizationNote: string;
  description: string;
  easyModeExplanation: string;
};

export type MacroFactorGroupConfig = {
  key: string;
  zhName: string;
  enName: string;
  description: string;
  maxContribution: number;
  minContribution: number;
  factors: MacroFactorConfig[];
};

export type MacroScoreConfig = {
  key: MacroScoreKey;
  zhName: string;
  enName: string;
  easyModeSubtitle: string;
  professionalDescription: string;
  methodologyTooltip: string;
  implementationStatus: ImplementationStatus;
  scoreRangeHint: {
    min: number;
    max: number;
    neutral: number;
  };
  preferredZScoreWindows: ZScoreWindow[];
  factorGroups: MacroFactorGroupConfig[];
  notes: string[];
};

export type MacroEngineConfig = {
  version: string;
  description: string;
  scores: Record<MacroScoreKey, MacroScoreConfig>;
};
