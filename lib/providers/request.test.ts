import { describe, expect, test } from "vitest";
import { requestJsonWithRetry } from "@/lib/providers/request";
import { ProviderFetchError } from "@/lib/providers/types";

function jsonResponse(status: number, body: unknown, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

describe("requestJsonWithRetry", () => {
  test("retries 429 rate limit responses", async () => {
    let calls = 0;
    const result = await requestJsonWithRetry<{ ok: boolean }>("https://example.com/data?api_key=secret", {
      provider: "FRED",
      maxRetries: 1,
      backoffBaseMs: 0,
      fetchFn: async () => {
        calls += 1;
        if (calls === 1) return jsonResponse(429, { error: "rate limit" }, { "Retry-After": "0" });
        return jsonResponse(200, { ok: true });
      },
    });

    expect(calls).toBe(2);
    expect(result).toEqual({ ok: true });
  });

  test("marks 401 and 403 as unauthorized without exposing api keys", async () => {
    await expect(
      requestJsonWithRetry("https://example.com/data?api_key=secret", {
        provider: "FRED",
        maxRetries: 0,
        fetchFn: async () => jsonResponse(401, { error: "bad key" }),
      }),
    ).rejects.toMatchObject({
      type: "UNAUTHORIZED",
      provider: "FRED",
      status: 401,
    });

    try {
      await requestJsonWithRetry("https://example.com/data?api_key=secret", {
        provider: "FRED",
        maxRetries: 0,
        fetchFn: async () => jsonResponse(403, { error: "forbidden" }),
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderFetchError);
      expect((error as Error).message).not.toContain("secret");
      expect(error).toMatchObject({ type: "UNAUTHORIZED", status: 403 });
    }
  });

  test("retries timeout errors", async () => {
    let calls = 0;
    const result = await requestJsonWithRetry<{ ok: boolean }>("https://example.com/slow", {
      provider: "YAHOO",
      timeoutMs: 1,
      maxRetries: 1,
      backoffBaseMs: 0,
      fetchFn: async (_url, init) => {
        calls += 1;
        if (calls === 1) {
          await new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          });
        }
        return jsonResponse(200, { ok: true });
      },
    });

    expect(calls).toBe(2);
    expect(result).toEqual({ ok: true });
  });

  test("retries 5xx provider errors", async () => {
    let calls = 0;
    const result = await requestJsonWithRetry<{ ok: boolean }>("https://example.com/provider", {
      provider: "FRED",
      maxRetries: 1,
      backoffBaseMs: 0,
      fetchFn: async () => {
        calls += 1;
        if (calls === 1) return jsonResponse(503, { error: "down" });
        return jsonResponse(200, { ok: true });
      },
    });

    expect(calls).toBe(2);
    expect(result).toEqual({ ok: true });
  });
});
