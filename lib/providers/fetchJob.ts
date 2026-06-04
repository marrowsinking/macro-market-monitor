import {
  ProviderFetchError,
  type FetchErrorType,
  type FetchJobResult,
  type ProviderFetcher,
  type ProviderIndicator,
  type StandardObservation,
  type DataFetchLogStatus,
} from "@/lib/providers/types";

export type RunFetchJobOptions<TIndicator extends ProviderIndicator> = {
  fetcher: ProviderFetcher<TIndicator, unknown, unknown>;
  indicators: TIndicator[];
  observationExists: (indicatorId: number, date: Date) => Promise<boolean>;
  insertObservation: (data: { indicatorId: number; date: Date; value: number }) => Promise<void>;
  writeFetchLog?: (data: {
    provider: string;
    symbol: string;
    indicatorId: number;
    status: DataFetchLogStatus;
    errorType?: FetchErrorType | null;
    errorMessage?: string | null;
    observationsInserted: number;
    observationsSkippedDuplicate: number;
    startedAt: Date;
    finishedAt: Date;
  }) => Promise<void>;
  log?: (message: string) => void;
};

function errorType(error: unknown): FetchErrorType {
  if (error instanceof ProviderFetchError) return error.type;
  return "UNKNOWN";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function validObservation(observation: StandardObservation): boolean {
  return observation.date instanceof Date && Number.isFinite(observation.date.getTime()) && Number.isFinite(observation.value);
}

export async function runFetchJob<TIndicator extends ProviderIndicator>(options: RunFetchJobOptions<TIndicator>): Promise<FetchJobResult> {
  const result: FetchJobResult = {
    provider: options.fetcher.provider,
    indicatorsChecked: options.indicators.length,
    success: 0,
    failed: 0,
    observationsInserted: 0,
    observationsSkipped: 0,
    errors: [],
  };

  for (const indicator of options.indicators) {
    const startedAt = new Date();
    let insertedForIndicator = 0;
    let duplicateSkippedForIndicator = 0;
    options.log?.(`Fetching ${indicator.symbol} from ${options.fetcher.provider}...`);

    try {
      const query = options.fetcher.transformQuery(indicator);
      const raw = await options.fetcher.extractData(query);
      const transformed = options.fetcher.transformData(raw, indicator);
      result.observationsSkipped += transformed.skipped;

      for (const observation of transformed.observations) {
        if (!validObservation(observation)) {
          result.observationsSkipped += 1;
          continue;
        }

        const exists = await options.observationExists(indicator.id, observation.date);
        if (exists) {
          result.observationsSkipped += 1;
          duplicateSkippedForIndicator += 1;
          continue;
        }

        await options.insertObservation({
          indicatorId: indicator.id,
          date: observation.date,
          value: observation.value,
        });
        result.observationsInserted += 1;
        insertedForIndicator += 1;
      }

      result.success += 1;
      await options.writeFetchLog?.({
        provider: options.fetcher.provider,
        symbol: indicator.symbol,
        indicatorId: indicator.id,
        status: "SUCCESS",
        errorType: null,
        errorMessage: null,
        observationsInserted: insertedForIndicator,
        observationsSkippedDuplicate: duplicateSkippedForIndicator,
        startedAt,
        finishedAt: new Date(),
      });
    } catch (error) {
      const type = errorType(error);
      const message = errorMessage(error);
      result.failed += 1;
      result.errors.push({
        indicatorId: indicator.id,
        symbol: indicator.symbol,
        provider: options.fetcher.provider,
        type,
        message,
      });
      await options.writeFetchLog?.({
        provider: options.fetcher.provider,
        symbol: indicator.symbol,
        indicatorId: indicator.id,
        status: "FAILED",
        errorType: type,
        errorMessage: message,
        observationsInserted: insertedForIndicator,
        observationsSkippedDuplicate: duplicateSkippedForIndicator,
        startedAt,
        finishedAt: new Date(),
      });
    }
  }

  return result;
}
