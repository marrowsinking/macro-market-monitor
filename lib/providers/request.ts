import { ProviderFetchError, type DataSource, type FetchErrorType } from "@/lib/providers/types";

type FetchLike = typeof fetch;

export type RequestJsonWithRetryOptions = {
  provider: DataSource;
  timeoutMs?: number;
  maxRetries?: number;
  backoffBaseMs?: number;
  fetchFn?: FetchLike;
};

const SECRET_QUERY_KEYS = new Set(["api_key", "apikey", "token", "access_token", "key"]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function sanitizeUrl(input: string): string {
  try {
    const url = new URL(input);
    for (const key of Array.from(url.searchParams.keys())) {
      if (SECRET_QUERY_KEYS.has(key.toLowerCase())) {
        url.searchParams.set(key, "[REDACTED]");
      }
    }
    return url.toString();
  } catch {
    return input.replace(/(api_key|apikey|token|access_token|key)=([^&\s]+)/gi, "$1=[REDACTED]");
  }
}

function retryAfterMs(response: Response): number | null {
  const retryAfter = response.headers.get("Retry-After");
  if (!retryAfter) return null;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const dateMs = new Date(retryAfter).getTime();
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());

  return null;
}

function classifyStatus(status: number): FetchErrorType {
  if (status === 401 || status === 403) return "UNAUTHORIZED";
  if (status === 404) return "NOT_FOUND";
  if (status === 408) return "TIMEOUT";
  if (status === 429) return "RATE_LIMIT";
  if (status >= 500) return "PROVIDER_ERROR";
  return "UNKNOWN";
}

function shouldRetry(errorType: FetchErrorType): boolean {
  return errorType === "TIMEOUT" || errorType === "RATE_LIMIT" || errorType === "PROVIDER_ERROR" || errorType === "NETWORK";
}

function backoffMs(attempt: number, baseMs: number): number {
  return baseMs * 2 ** attempt;
}

async function parseErrorMessage(response: Response, url: string): Promise<string> {
  let detail = "";
  try {
    detail = await response.text();
  } catch {
    detail = "";
  }
  const safeDetail = detail ? ` ${detail.slice(0, 220)}` : "";
  return `${sanitizeUrl(url)} failed with HTTP ${response.status}.${safeDetail}`;
}

export async function requestJsonWithRetry<T>(url: string, options: RequestJsonWithRetryOptions): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxRetries = options.maxRetries ?? 2;
  const backoffBaseMs = options.backoffBaseMs ?? 500;
  const fetchFn = options.fetchFn ?? fetch;
  let lastError: ProviderFetchError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchFn(url, {
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const type = classifyStatus(response.status);
        const error = new ProviderFetchError({
          provider: options.provider,
          type,
          status: response.status,
          message: await parseErrorMessage(response, url),
        });

        if (attempt < maxRetries && shouldRetry(type)) {
          await sleep(retryAfterMs(response) ?? backoffMs(attempt, backoffBaseMs));
          lastError = error;
          continue;
        }

        throw error;
      }

      return (await response.json()) as T;
    } catch (caught) {
      clearTimeout(timeout);

      if (caught instanceof ProviderFetchError) {
        throw caught;
      }

      const caughtName = caught instanceof Error ? caught.name : "";
      const type: FetchErrorType = caughtName === "AbortError" ? "TIMEOUT" : "NETWORK";
      const error = new ProviderFetchError({
        provider: options.provider,
        type,
        message: `${sanitizeUrl(url)} failed: ${caught instanceof Error ? caught.message : String(caught)}`,
      });

      if (attempt < maxRetries && shouldRetry(type)) {
        await sleep(backoffMs(attempt, backoffBaseMs));
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new ProviderFetchError({ provider: options.provider, type: "UNKNOWN", message: `${sanitizeUrl(url)} failed.` });
}
