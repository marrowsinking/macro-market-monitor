import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export type YahooHistoricalObservation = {
  date: string;
  close: number;
};

export type YahooHistoricalRow = {
  date?: Date | string | null;
  close?: number | null;
};

export type YahooAsset = {
  name: string;
  symbol: string;
  category: string;
  description: string;
  macroLogic: string;
};

export const yahooAssets: YahooAsset[] = [
  {
    name: "美元指數",
    symbol: "DX-Y.NYB",
    category: "美元",
    description: "衡量美元相對主要貨幣的一籃子指數",
    macroLogic: "DXY上升通常代表美元流動性收緊，對風險資產和商品形成壓力",
  },
  {
    name: "S&P 500",
    symbol: "^GSPC",
    category: "風險資產",
    description: "標普 500 指數 Yahoo 價格數據。",
    macroLogic: "上升代表風險偏好改善；下跌代表風險偏好惡化。",
  },
  {
    name: "Nasdaq 100",
    symbol: "^NDX",
    category: "風險資產",
    description: "納斯達克 100 指數 Yahoo 價格數據。",
    macroLogic: "成長股風險偏好指標。",
  },
  {
    name: "Gold Futures",
    symbol: "GC=F",
    category: "商品",
    description: "COMEX 黃金期貨 Yahoo 價格數據。",
    macroLogic: "上升通常受益於實際利率下降、美元走弱或避險。",
  },
  {
    name: "Silver Futures",
    symbol: "SI=F",
    category: "商品",
    description: "COMEX 白銀期貨 Yahoo 價格數據。",
    macroLogic: "相對黃金更強時，常表示商品週期或工業需求改善。",
  },
  {
    name: "Copper Futures",
    symbol: "HG=F",
    category: "商品",
    description: "COMEX 銅期貨 Yahoo 價格數據。",
    macroLogic: "上升代表工業週期改善；下跌代表需求放緩。",
  },
  {
    name: "USDJPY",
    symbol: "JPY=X",
    category: "外匯",
    description: "美元兌日元 Yahoo 匯率數據。",
    macroLogic: "上升可能反映美元利差優勢或日元壓力。",
  },
  {
    name: "USDCNH",
    symbol: "CNH=X",
    category: "外匯",
    description: "離岸人民幣 Yahoo 匯率數據。",
    macroLogic: "上升代表人民幣走弱和中國資產壓力。",
  },
];

function toDateOnly(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

export function normalizeYahooHistoricalRows(rows: YahooHistoricalRow[]): YahooHistoricalObservation[] {
  return rows.flatMap((row) => {
    if (!row.date) return [];
    if (row.close === null || row.close === undefined || !Number.isFinite(row.close)) return [];

    return [
      {
        date: toDateOnly(row.date),
        close: row.close,
      },
    ];
  });
}

export async function fetchYahooHistorical(
  symbol: string,
  options: { period1: Date; period2?: Date; interval?: "1d" | "1wk" | "1mo" },
): Promise<YahooHistoricalObservation[]> {
  const result = await yahooFinance.chart(symbol, {
    period1: options.period1,
    period2: options.period2,
    interval: options.interval ?? "1d",
    return: "array",
  });

  return normalizeYahooHistoricalRows(result.quotes);
}
