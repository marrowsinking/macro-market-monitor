import { assertFredApiKey } from "@/lib/fred";
import { requestJsonWithRetry, type RequestJsonWithRetryOptions } from "@/lib/providers/request";
import { ProviderFetchError, type ProviderFetcher, type ProviderIndicator, type ProviderTransformResult } from "@/lib/providers/types";

const FRED_BASE_URL = "https://api.stlouisfed.org/fred";

export type FredProviderIndicator = ProviderIndicator & {
  fredSeriesId: string | null;
};

export type FredProviderQuery = {
  seriesId: string;
  url: string;
};

export type FredApiObservation = {
  date: string;
  value: string | null;
};

export type FredApiResponse = {
  observations?: FredApiObservation[];
  error_code?: number;
  error_message?: string;
};

export type FredFetcherOptions = {
  apiKey?: string;
  observationStart?: string;
  observationEnd?: string;
  timeoutMs?: number;
  maxRetries?: number;
  backoffBaseMs?: number;
  fetchFn?: RequestJsonWithRetryOptions["fetchFn"];
};

function fredUrl(input: { seriesId: string; apiKey: string; observationStart?: string; observationEnd?: string }): string {
  const url = new URL(`${FRED_BASE_URL}/series/observations`);
  url.searchParams.set("series_id", input.seriesId);
  url.searchParams.set("api_key", input.apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "asc");
  if (input.observationStart) url.searchParams.set("observation_start", input.observationStart);
  if (input.observationEnd) url.searchParams.set("observation_end", input.observationEnd);
  return url.toString();
}

export function createFredFetcher(options: FredFetcherOptions = {}): ProviderFetcher<FredProviderIndicator, FredProviderQuery, FredApiResponse> {
  const apiKey = options.apiKey ?? assertFredApiKey();

  return {
    provider: "FRED",
    transformQuery(indicator) {
      if (!indicator.fredSeriesId) {
        throw new ProviderFetchError({
          provider: "FRED",
          type: "INVALID_RESPONSE",
          message: `${indicator.symbol} does not have fredSeriesId.`,
        });
      }

      return {
        seriesId: indicator.fredSeriesId,
        url: fredUrl({
          seriesId: indicator.fredSeriesId,
          apiKey,
          observationStart: options.observationStart,
          observationEnd: options.observationEnd,
        }),
      };
    },
    async extractData(query) {
      const payload = await requestJsonWithRetry<FredApiResponse>(query.url, {
        provider: "FRED",
        timeoutMs: options.timeoutMs,
        maxRetries: options.maxRetries,
        backoffBaseMs: options.backoffBaseMs,
        fetchFn: options.fetchFn,
      });

      if (payload.error_message) {
        throw new ProviderFetchError({
          provider: "FRED",
          type: "PROVIDER_ERROR",
          message: `FRED error for ${query.seriesId}: ${payload.error_message}`,
        });
      }

      return payload;
    },
    transformData(raw): ProviderTransformResult {
      const rows = raw.observations ?? [];
      const observations = [];
      let skipped = 0;

      for (const item of rows) {
        if (item.value === null) {
          skipped += 1;
          continue;
        }

        const rawValue = item.value.trim();
        if (!rawValue || rawValue === ".") {
          skipped += 1;
          continue;
        }

        const value = Number(rawValue);
        if (!Number.isFinite(value)) {
          skipped += 1;
          continue;
        }

        observations.push({
          date: new Date(`${item.date}T00:00:00.000Z`),
          value,
        });
      }

      return { observations, skipped };
    },
  };
}
