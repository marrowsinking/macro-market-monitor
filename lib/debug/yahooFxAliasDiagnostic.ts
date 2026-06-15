import type { YahooHistoricalRow } from "@/lib/yahoo";

export const YAHOO_FX_ALIAS_CANDIDATES = ["CNH=X", "USDCNH=X", "CNHUSD=X", "CNY=X", "USDCNY=X"] as const;

export type YahooFxAliasStatus = "GOOD" | "MINIMUM_OK" | "BAD" | "FAILED";

export type YahooFxAliasDiagnosticResult = {
  symbol: string;
  status: YahooFxAliasStatus;
  observationCount: number;
  firstDate: string | null;
  latestDate: string | null;
  sampleFirstValue: number | null;
  sampleLatestValue: number | null;
  errorMessage: string | null;
  isRecommended: boolean;
};

export type YahooFxAliasDiagnosticReport = {
  generatedAt: string;
  results: YahooFxAliasDiagnosticResult[];
  rankedResults: YahooFxAliasDiagnosticResult[];
};

type BuildYahooFxAliasDiagnosticOptions = {
  candidates?: readonly string[];
  fetchRows: (symbol: string) => Promise<YahooHistoricalRow[]>;
};

function toDateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function validRows(rows: YahooHistoricalRow[]): Array<{ date: string; value: number }> {
  return rows
    .flatMap((row) => {
      if (!row.date || row.close === null || row.close === undefined || !Number.isFinite(row.close)) return [];
      return [{ date: toDateKey(row.date), value: row.close }];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function statusForCount(count: number, failed: boolean): YahooFxAliasStatus {
  if (failed) return "FAILED";
  if (count >= 500) return "GOOD";
  if (count >= 30) return "MINIMUM_OK";
  return "BAD";
}

export function summarizeYahooFxRows(symbol: string, rows: YahooHistoricalRow[], errorMessage?: string): YahooFxAliasDiagnosticResult {
  const points = validRows(rows);
  const status = statusForCount(points.length, Boolean(errorMessage));

  return {
    symbol,
    status,
    observationCount: points.length,
    firstDate: points[0]?.date ?? null,
    latestDate: points.at(-1)?.date ?? null,
    sampleFirstValue: points[0]?.value ?? null,
    sampleLatestValue: points.at(-1)?.value ?? null,
    errorMessage: errorMessage ?? null,
    isRecommended: points.length >= 1000,
  };
}

function latestDateDistance(date: string | null): number {
  if (!date) return Number.POSITIVE_INFINITY;
  return Math.abs(Date.now() - new Date(`${date}T00:00:00.000Z`).getTime());
}

export function rankYahooFxAliasResults(results: YahooFxAliasDiagnosticResult[]): YahooFxAliasDiagnosticResult[] {
  return [...results].sort((a, b) => {
    if (b.observationCount !== a.observationCount) return b.observationCount - a.observationCount;

    const firstDateCompare = (a.firstDate ?? "9999-12-31").localeCompare(b.firstDate ?? "9999-12-31");
    if (firstDateCompare !== 0) return firstDateCompare;

    return latestDateDistance(a.latestDate) - latestDateDistance(b.latestDate);
  });
}

export async function buildYahooFxAliasDiagnostic(options: BuildYahooFxAliasDiagnosticOptions): Promise<YahooFxAliasDiagnosticReport> {
  const candidates = options.candidates ?? YAHOO_FX_ALIAS_CANDIDATES;
  const results: YahooFxAliasDiagnosticResult[] = [];

  for (const symbol of candidates) {
    try {
      const rows = await options.fetchRows(symbol);
      results.push(summarizeYahooFxRows(symbol, rows));
    } catch (error) {
      results.push(summarizeYahooFxRows(symbol, [], error instanceof Error ? error.message : String(error)));
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    results,
    rankedResults: rankYahooFxAliasResults(results),
  };
}
