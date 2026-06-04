const FRED_BASE_URL = "https://api.stlouisfed.org/fred";

export type FredObservation = {
  date: string;
  value: number;
};

type FredApiObservation = {
  date: string;
  value: string | null;
};

type FredApiResponse = {
  observations?: FredApiObservation[];
  error_code?: number;
  error_message?: string;
};

export function getFredApiKey(): string | null {
  const key = process.env.FRED_API_KEY?.trim();
  return key ? key : null;
}

export function assertFredApiKey(): string {
  const key = getFredApiKey();
  if (!key) {
    throw new Error("FRED_API_KEY is not set. Add it to .env.local before running fetch:fred.");
  }
  return key;
}

export function normalizeFredObservations(observations: FredApiObservation[]): FredObservation[] {
  return observations.flatMap((item) => {
    if (item.value === null) return [];
    const rawValue = item.value.trim();
    if (!rawValue || rawValue === ".") return [];

    const value = Number(rawValue);
    if (!Number.isFinite(value)) return [];

    return [{ date: item.date, value }];
  });
}

export async function fetchFredObservations(
  seriesId: string,
  options: { apiKey?: string; observationStart?: string; observationEnd?: string } = {},
): Promise<FredObservation[]> {
  const apiKey = options.apiKey ?? assertFredApiKey();
  const url = new URL(`${FRED_BASE_URL}/series/observations`);
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "asc");
  if (options.observationStart) url.searchParams.set("observation_start", options.observationStart);
  if (options.observationEnd) url.searchParams.set("observation_end", options.observationEnd);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`FRED request failed for ${seriesId}: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as FredApiResponse;
  if (payload.error_message) {
    throw new Error(`FRED error for ${seriesId}: ${payload.error_message}`);
  }

  return normalizeFredObservations(payload.observations ?? []);
}
