export type IndicatorStatus = "active" | "placeholder" | "disabled" | "deprecated";

export type IndicatorVisibilityMeta = {
  status: IndicatorStatus;
  isScoreInput: boolean;
  isCoreIndicator: boolean;
  replacedBy: string | null;
};

export type IndicatorVisibilityInput = {
  symbol: string;
  category: string;
  source: string;
  status?: string | null;
  isScoreInput?: boolean | null;
  isCoreIndicator?: boolean | null;
  replacedBy?: string | null;
};

export const scoreInputSymbols = new Set([
  "DGS2",
  "DGS10",
  "WALCL",
  "RRPONTSYD",
  "SOFR",
  "BAMLH0A0HYM2",
  "CPIAUCSL",
  "CPILFESL",
  "PCEPI",
  "PCEPILFE",
  "DCOILWTICO",
  "UNRATE",
  "ICSA",
  "PAYEMS",
  "JTSJOL",
  "VIXCLS",
  "DX-Y.NYB",
  "^GSPC",
  "^NDX",
  "GC=F",
  "SI=F",
  "HG=F",
  "JPY=X",
  "CNY=X",
]);

export const coreIndicatorSymbols = new Set([
  "DGS2",
  "DGS10",
  "T10Y2Y",
  "DFEDTARU",
  "SOFR",
  "WALCL",
  "RRPONTSYD",
  "WTREGEN",
  "CPIAUCSL",
  "CPILFESL",
  "PCEPI",
  "PCEPILFE",
  "PAYEMS",
  "UNRATE",
  "ICSA",
  "JTSJOL",
  "BAMLH0A0HYM2",
  "VIXCLS",
  "DCOILWTICO",
  "DX-Y.NYB",
  "^GSPC",
  "^NDX",
  "GC=F",
  "SI=F",
  "HG=F",
  "JPY=X",
  "CNY=X",
]);

const statusOverrides: Record<string, Pick<IndicatorVisibilityMeta, "status" | "replacedBy">> = {
  GOLDAMGBD228NLBM: { status: "deprecated", replacedBy: "GC=F" },
  SLVPRUSD: { status: "deprecated", replacedBy: "SI=F" },
  GOLD_SILVER_RATIO: { status: "disabled", replacedBy: null },
  DXY: { status: "deprecated", replacedBy: "DX-Y.NYB" },
  SPX: { status: "deprecated", replacedBy: "^GSPC" },
  NDX: { status: "deprecated", replacedBy: "^NDX" },
  COPPER: { status: "deprecated", replacedBy: "HG=F" },
  USDJPY: { status: "deprecated", replacedBy: "JPY=X" },
  USDCNH: { status: "deprecated", replacedBy: "CNY=X" },
  "CNH=X": { status: "deprecated", replacedBy: "CNY=X" },
  HYG: { status: "disabled", replacedBy: null },
  RUT: { status: "disabled", replacedBy: null },
  CHINA_M2: { status: "placeholder", replacedBy: null },
  CHINA_TSF: { status: "placeholder", replacedBy: null },
  CHINA_PMI: { status: "placeholder", replacedBy: null },
  CHINA_PPI: { status: "placeholder", replacedBy: null },
  HSTECH: { status: "placeholder", replacedBy: null },
  CSI300: { status: "placeholder", replacedBy: null },
};

function validStatus(value: string | null | undefined): IndicatorStatus | null {
  if (value === "active" || value === "placeholder" || value === "disabled" || value === "deprecated") return value;
  return null;
}

function fallbackStatus(indicator: IndicatorVisibilityInput): IndicatorStatus {
  const override = statusOverrides[indicator.symbol];
  if (override) return override.status;
  if (indicator.source === "PLACEHOLDER") return "placeholder";
  if (indicator.source === "DISABLED") return "disabled";
  return "active";
}

export function getIndicatorVisibility(indicator: IndicatorVisibilityInput): IndicatorVisibilityMeta {
  const override = statusOverrides[indicator.symbol];
  const status = validStatus(indicator.status) ?? override?.status ?? fallbackStatus(indicator);

  return {
    status,
    isScoreInput: indicator.isScoreInput ?? scoreInputSymbols.has(indicator.symbol),
    isCoreIndicator: indicator.isCoreIndicator ?? coreIndicatorSymbols.has(indicator.symbol),
    replacedBy: indicator.replacedBy ?? override?.replacedBy ?? null,
  };
}

export function isIndicatorActive(indicator: IndicatorVisibilityInput): boolean {
  return getIndicatorVisibility(indicator).status === "active";
}

export function isDefaultIndicatorVisible(indicator: IndicatorVisibilityInput, categoryFilter: string): boolean {
  const meta = getIndicatorVisibility(indicator);
  if (meta.status === "active") return true;
  return categoryFilter === "中國" && indicator.category === "中國" && meta.status === "placeholder";
}
