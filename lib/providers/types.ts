export type DataSource = "FRED" | "YAHOO" | "FMP" | "NASDAQ" | "MANUAL";

export type FetchErrorType =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "PROVIDER_ERROR"
  | "NETWORK"
  | "INVALID_RESPONSE"
  | "UNKNOWN";

export class ProviderFetchError extends Error {
  readonly type: FetchErrorType;
  readonly provider: DataSource;
  readonly status?: number;

  constructor(input: { provider: DataSource; type: FetchErrorType; message: string; status?: number }) {
    super(input.message);
    this.name = "ProviderFetchError";
    this.provider = input.provider;
    this.type = input.type;
    this.status = input.status;
  }
}

export type StandardObservation = {
  date: Date;
  value: number;
};

export type FetchJobError = {
  indicatorId: number;
  symbol: string;
  provider: DataSource;
  type: FetchErrorType;
  message: string;
};

export type DataFetchLogStatus = "SUCCESS" | "FAILED" | "SKIPPED";

export type FetchJobResult = {
  provider: DataSource;
  indicatorsChecked: number;
  success: number;
  failed: number;
  observationsInserted: number;
  observationsSkipped: number;
  errors: FetchJobError[];
};

export type ProviderTransformResult = {
  observations: StandardObservation[];
  skipped: number;
};

export type ProviderIndicator = {
  id: number;
  symbol: string;
  fredSeriesId?: string | null;
};

export interface ProviderFetcher<TIndicator extends ProviderIndicator = ProviderIndicator, TQuery = unknown, TRaw = unknown> {
  provider: DataSource;
  transformQuery(indicator: TIndicator): TQuery;
  extractData(query: TQuery): Promise<TRaw>;
  transformData(raw: TRaw, indicator: TIndicator): ProviderTransformResult;
}
