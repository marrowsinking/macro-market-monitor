export type IndicatorSeed = {
  name: string;
  symbol: string;
  category: string;
  source: string;
  fredSeriesId: string | null;
  frequency: string;
  description: string;
  macroLogic: string;
};

export const categories = [
  "利率",
  "流動性",
  "通脹",
  "就業",
  "增長",
  "美元",
  "風險資產",
  "信用",
  "商品",
  "中國",
] as const;

export const indicatorCatalog: IndicatorSeed[] = [
  { name: "2-Year Treasury Yield", symbol: "DGS2", category: "利率", source: "FRED", fredSeriesId: "DGS2", frequency: "daily", description: "美國 2 年期國債收益率。", macroLogic: "下降通常代表降息預期升溫；上升代表政策利率壓力更高。" },
  { name: "10-Year Treasury Yield", symbol: "DGS10", category: "利率", source: "FRED", fredSeriesId: "DGS10", frequency: "daily", description: "美國 10 年期國債收益率。", macroLogic: "上升可能代表再通脹或期限溢價上升；下降可能代表衰退或降息交易。" },
  { name: "10Y minus 2Y Treasury Spread", symbol: "T10Y2Y", category: "利率", source: "FRED", fredSeriesId: "T10Y2Y", frequency: "daily", description: "10 年期與 2 年期美債利差。", macroLogic: "倒掛收斂或轉正常出現在週期後段，需要配合就業和信用判斷。" },
  { name: "Federal Funds Target Range Upper Limit", symbol: "DFEDTARU", category: "利率", source: "FRED", fredSeriesId: "DFEDTARU", frequency: "daily", description: "聯邦基金目標區間上限。", macroLogic: "政策利率水平越高，金融條件通常越緊。" },
  { name: "Secured Overnight Financing Rate", symbol: "SOFR", category: "利率", source: "FRED", fredSeriesId: "SOFR", frequency: "daily", description: "美元隔夜擔保融資利率。", macroLogic: "異常上升可能代表短端資金壓力。" },
  { name: "Fed Balance Sheet", symbol: "WALCL", category: "流動性", source: "FRED", fredSeriesId: "WALCL", frequency: "weekly", description: "美聯儲資產負債表規模。", macroLogic: "上升通常代表基礎流動性改善；下降代表 QT 或流動性回收。" },
  { name: "Overnight Reverse Repurchase Agreements", symbol: "RRPONTSYD", category: "流動性", source: "FRED", fredSeriesId: "RRPONTSYD", frequency: "daily", description: "隔夜逆回購工具用量。", macroLogic: "下降可能釋放市場流動性；上升代表資金回流 Fed。" },
  { name: "Treasury General Account", symbol: "WTREGEN", category: "流動性", source: "FRED", fredSeriesId: "WTREGEN", frequency: "weekly", description: "美國財政部一般賬戶。", macroLogic: "TGA 上升會抽走銀行體系流動性；下降則釋放流動性。" },
  { name: "CPI", symbol: "CPIAUCSL", category: "通脹", source: "FRED", fredSeriesId: "CPIAUCSL", frequency: "monthly", description: "美國居民消費價格指數。", macroLogic: "上升代表通脹壓力；下降支持降息交易。" },
  { name: "Core CPI", symbol: "CPILFESL", category: "通脹", source: "FRED", fredSeriesId: "CPILFESL", frequency: "monthly", description: "剔除食品能源的核心 CPI。", macroLogic: "核心通脹粘性會限制降息空間。" },
  { name: "PCE Price Index", symbol: "PCEPI", category: "通脹", source: "FRED", fredSeriesId: "PCEPI", frequency: "monthly", description: "PCE 價格指數。", macroLogic: "Fed 重要通脹觀察口徑。" },
  { name: "Core PCE", symbol: "PCEPILFE", category: "通脹", source: "FRED", fredSeriesId: "PCEPILFE", frequency: "monthly", description: "核心 PCE 價格指數。", macroLogic: "核心 PCE 回落通常支持寬鬆預期。" },
  { name: "Nonfarm Payrolls", symbol: "PAYEMS", category: "就業", source: "FRED", fredSeriesId: "PAYEMS", frequency: "monthly", description: "非農就業人數。", macroLogic: "上升代表就業韌性；走弱代表增長放緩。" },
  { name: "Unemployment Rate", symbol: "UNRATE", category: "就業", source: "FRED", fredSeriesId: "UNRATE", frequency: "monthly", description: "失業率。", macroLogic: "上升代表衰退風險增加；下降代表勞動市場偏強。" },
  { name: "Initial Claims", symbol: "ICSA", category: "就業", source: "FRED", fredSeriesId: "ICSA", frequency: "weekly", description: "初請失業金人數。", macroLogic: "快速上升通常是勞動市場惡化信號。" },
  { name: "Job Openings", symbol: "JTSJOL", category: "就業", source: "FRED", fredSeriesId: "JTSJOL", frequency: "monthly", description: "JOLTS 職位空缺。", macroLogic: "下降代表勞動需求降溫。" },
  { name: "High Yield Spread", symbol: "BAMLH0A0HYM2", category: "信用", source: "FRED", fredSeriesId: "BAMLH0A0HYM2", frequency: "daily", description: "美國高收益債信用利差。", macroLogic: "擴大代表信用風險上升；收窄代表風險偏好改善。" },
  { name: "VIX", symbol: "VIXCLS", category: "風險資產", source: "FRED", fredSeriesId: "VIXCLS", frequency: "daily", description: "標普 500 隱含波動率。", macroLogic: "上升代表避險需求升高；下降代表風險偏好改善。" },
  { name: "WTI Crude Oil", symbol: "DCOILWTICO", category: "商品", source: "FRED", fredSeriesId: "DCOILWTICO", frequency: "daily", description: "WTI 原油現貨價格。", macroLogic: "上升支持再通脹和商品週期；急跌代表需求壓力。" },
  { name: "FRED LBMA Gold Price", symbol: "GOLDAMGBD228NLBM", category: "商品", source: "DISABLED", fredSeriesId: null, frequency: "daily", description: "FRED LBMA gold series, currently not used. Gold regime logic uses Yahoo GC=F instead.", macroLogic: "Deprecated/disabled: do not use for current regime calculation." },
  { name: "FRED Silver Price", symbol: "SLVPRUSD", category: "商品", source: "DISABLED", fredSeriesId: null, frequency: "daily", description: "FRED silver series, currently not used. Silver regime logic uses Yahoo SI=F instead.", macroLogic: "Deprecated/disabled: do not use for current regime calculation." },
  { name: "Gold/Silver Ratio", symbol: "GOLD_SILVER_RATIO", category: "商品", source: "DERIVED", fredSeriesId: null, frequency: "daily", description: "Yahoo GC=F 除以 SI=F 的金銀比。", macroLogic: "高於 90 偏避險或工業需求偏弱；低於 60 可能代表白銀或商品週期偏熱。" },
  { name: "DXY", symbol: "DXY", category: "美元", source: "PLACEHOLDER", fredSeriesId: null, frequency: "daily", description: "美元指數，後續接入 Yahoo/FMP。", macroLogic: "上升代表美元壓力和全球流動性收緊；下降支持風險資產和黃金。" },
  { name: "S&P 500", symbol: "SPX", category: "風險資產", source: "PLACEHOLDER", fredSeriesId: null, frequency: "daily", description: "標普 500，後續接入 Yahoo/FMP。", macroLogic: "上升代表風險偏好改善；下跌代表風險偏好惡化。" },
  { name: "Nasdaq 100", symbol: "NDX", category: "風險資產", source: "PLACEHOLDER", fredSeriesId: null, frequency: "daily", description: "納斯達克 100，後續接入 Yahoo/FMP。", macroLogic: "成長股風險偏好指標。" },
  { name: "Russell 2000", symbol: "RUT", category: "風險資產", source: "PLACEHOLDER", fredSeriesId: null, frequency: "daily", description: "羅素 2000，後續接入 Yahoo/FMP。", macroLogic: "美國內需和小盤股風險偏好指標。" },
  { name: "HYG", symbol: "HYG", category: "信用", source: "PLACEHOLDER", fredSeriesId: null, frequency: "daily", description: "高收益債 ETF，後續接入 Yahoo/FMP。", macroLogic: "價格走弱通常代表信用風險升高。" },
  { name: "Copper", symbol: "COPPER", category: "商品", source: "PLACEHOLDER", fredSeriesId: null, frequency: "daily", description: "銅價，後續接入 Nasdaq Data Link/Trading Economics。", macroLogic: "上升代表工業週期改善；下跌代表需求放緩。" },
  { name: "USDJPY", symbol: "USDJPY", category: "美元", source: "PLACEHOLDER", fredSeriesId: null, frequency: "daily", description: "美元兌日元。", macroLogic: "上升可能反映美元利差優勢或日元壓力。" },
  { name: "USDCNH", symbol: "USDCNH", category: "中國", source: "PLACEHOLDER", fredSeriesId: null, frequency: "daily", description: "離岸人民幣匯率。", macroLogic: "上升代表人民幣走弱和中國資產壓力。" },
  { name: "China M2", symbol: "CHINA_M2", category: "中國", source: "PLACEHOLDER", fredSeriesId: null, frequency: "monthly", description: "中國 M2，後續接入 Trading Economics。", macroLogic: "上升代表貨幣條件改善。" },
  { name: "China TSF", symbol: "CHINA_TSF", category: "中國", source: "PLACEHOLDER", fredSeriesId: null, frequency: "monthly", description: "中國社融，後續接入 Trading Economics。", macroLogic: "改善代表信用週期修復。" },
  { name: "China PMI", symbol: "CHINA_PMI", category: "中國", source: "PLACEHOLDER", fredSeriesId: null, frequency: "monthly", description: "中國 PMI，後續接入 Trading Economics。", macroLogic: "上升代表製造業景氣改善。" },
  { name: "China PPI", symbol: "CHINA_PPI", category: "中國", source: "PLACEHOLDER", fredSeriesId: null, frequency: "monthly", description: "中國 PPI，後續接入 Trading Economics。", macroLogic: "回升代表工業價格週期改善。" },
  { name: "HS Tech Index", symbol: "HSTECH", category: "中國", source: "PLACEHOLDER", fredSeriesId: null, frequency: "daily", description: "恒生科技指數。", macroLogic: "上升代表中國成長資產風險偏好改善。" },
  { name: "CSI 300", symbol: "CSI300", category: "中國", source: "PLACEHOLDER", fredSeriesId: null, frequency: "daily", description: "滬深 300。", macroLogic: "中國核心權益資產風險偏好指標。" },
];
