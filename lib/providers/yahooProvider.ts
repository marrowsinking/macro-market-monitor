import YahooFinance from "yahoo-finance2";
import { yahooAssets, type YahooHistoricalRow } from "@/lib/yahoo";
import { ProviderFetchError, type ProviderFetcher, type ProviderIndicator, type ProviderTransformResult } from "@/lib/providers/types";

const yahooFinance = new YahooFinance();

export type YahooProviderIndicator = ProviderIndicator;

export type YahooProviderQuery = {
  symbol: string;
  period1: Date;
  period2: Date;
  interval: "1d" | "1wk" | "1mo";
};

export type YahooFetcherOptions = {
  period1: Date;
  period2?: Date;
  interval?: "1d" | "1wk" | "1mo";
  fetchHistoricalRows?: (query: YahooProviderQuery) => Promise<YahooHistoricalRow[]>;
};

function toDateOnly(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

async function defaultFetchHistoricalRows(query: YahooProviderQuery): Promise<YahooHistoricalRow[]> {
  const result = await yahooFinance.chart(query.symbol, {
    period1: query.period1,
    period2: query.period2,
    interval: query.interval,
    return: "array",
  });

  return result.quotes;
}

export function createYahooFetcher(options: YahooFetcherOptions): ProviderFetcher<YahooProviderIndicator, YahooProviderQuery, YahooHistoricalRow[]> {
  return {
    provider: "YAHOO",
    transformQuery(indicator) {
      return {
        symbol: indicator.symbol,
        period1: options.period1,
        period2: options.period2 ?? new Date(),
        interval: options.interval ?? "1d",
      };
    },
    async extractData(query) {
      try {
        return await (options.fetchHistoricalRows ?? defaultFetchHistoricalRows)(query);
      } catch (error) {
        throw new ProviderFetchError({
          provider: "YAHOO",
          type: "PROVIDER_ERROR",
          message: `Yahoo request failed for ${query.symbol}: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
    transformData(raw): ProviderTransformResult {
      const observations = [];
      let skipped = 0;

      for (const row of raw) {
        if (!row.date || row.close === null || row.close === undefined || !Number.isFinite(row.close)) {
          skipped += 1;
          continue;
        }

        observations.push({
          date: toDateOnly(row.date),
          value: row.close,
        });
      }

      return { observations, skipped };
    },
  };
}

export { yahooAssets };
