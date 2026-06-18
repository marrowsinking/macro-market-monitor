import { describe, expect, test } from "vitest";
import {
  buildCoverageRows,
  buildCoverageSummary,
  collectConfiguredSymbolUsage,
  createDataCoverageDebugPayload,
} from "@/lib/debug/dataCoverageDebugService";

describe("dataCoverageDebugService", () => {
  test("collectConfiguredSymbolUsage returns configured symbols and merges repeated usages", () => {
    const symbols = collectConfiguredSymbolUsage();
    const oil = symbols.find((item) => item.symbol === "DCOILWTICO");

    expect(symbols.length).toBeGreaterThan(0);
    expect(oil?.usages.length).toBeGreaterThan(1);
    expect(oil?.usages.map((usage) => usage.scoreKey)).toEqual(expect.arrayContaining(["inflation_score", "commodity_score"]));
  });

  test("derived and placeholder symbols are not treated as database missing", () => {
    const configuredSymbols = collectConfiguredSymbolUsage().filter((item) => ["GOLD_SILVER_RATIO", "CHINA_M2"].includes(item.symbol));
    const rows = buildCoverageRows({
      configuredSymbols,
      dbStats: [],
      now: new Date("2026-06-15T00:00:00Z"),
    });

    expect(rows.find((row) => row.symbol === "GOLD_SILVER_RATIO")?.status).toBe("derived");
    expect(rows.find((row) => row.symbol === "CHINA_M2")?.status).toBe("placeholder");
  });

  test("normal symbols with zero observations are missing", () => {
    const configuredSymbols = collectConfiguredSymbolUsage().filter((item) => item.symbol === "VIXCLS");
    const rows = buildCoverageRows({
      configuredSymbols,
      dbStats: [],
      now: new Date("2026-06-15T00:00:00Z"),
    });

    expect(rows[0].status).toBe("missing");
    expect(rows[0].message).toContain("no observations");
  });

  test("symbols below required observations are insufficient", () => {
    const configuredSymbols = collectConfiguredSymbolUsage().filter((item) => item.symbol === "CNY=X");
    const rows = buildCoverageRows({
      configuredSymbols,
      dbStats: [{ symbol: "CNY=X", observationCount: 8, firstDate: "2026-06-01", latestDate: "2026-06-10" }],
      now: new Date("2026-06-15T00:00:00Z"),
    });

    expect(rows[0]).toMatchObject({
      symbol: "CNY=X",
      status: "insufficient",
      observationCount: 8,
      requiredMinimumObservations: 30,
    });
  });

  test("daily market data older than stale threshold is stale", () => {
    const configuredSymbols = collectConfiguredSymbolUsage().filter((item) => item.symbol === "DX-Y.NYB");
    const rows = buildCoverageRows({
      configuredSymbols,
      dbStats: [{ symbol: "DX-Y.NYB", observationCount: 100, firstDate: "2025-01-01", latestDate: "2026-06-01" }],
      now: new Date("2026-06-15T00:00:00Z"),
    });

    expect(rows[0].status).toBe("stale");
    expect(rows[0].daysSinceLatest).toBe(14);
  });

  test("monthly macro data at 48 days is carried forward when observation count is sufficient", () => {
    const configuredSymbols = collectConfiguredSymbolUsage().filter((item) => item.symbol === "CPIAUCSL");
    const rows = buildCoverageRows({
      configuredSymbols,
      dbStats: [{ symbol: "CPIAUCSL", observationCount: 120, firstDate: "2016-01-01", latestDate: "2026-04-28" }],
      now: new Date("2026-06-15T00:00:00Z"),
    });

    expect(rows[0].status).toBe("carried_forward");
    expect(rows[0].freshnessStatus).toBe("carried_forward");
    expect(rows[0].decayFactor).toBe(1);
    expect(rows[0].daysSinceLatest).toBe(48);
  });

  test("summary counts rows and high impact issues include CNY=X insufficient", () => {
    const configuredSymbols = collectConfiguredSymbolUsage().filter((item) => ["CNY=X", "DX-Y.NYB", "GOLD_SILVER_RATIO", "CHINA_M2"].includes(item.symbol));
    const rows = buildCoverageRows({
      configuredSymbols,
      dbStats: [
        { symbol: "CNY=X", observationCount: 8, firstDate: "2026-06-01", latestDate: "2026-06-10" },
        { symbol: "DX-Y.NYB", observationCount: 100, firstDate: "2025-01-01", latestDate: "2026-06-14" },
      ],
      now: new Date("2026-06-15T00:00:00Z"),
    });
    const summary = buildCoverageSummary(rows);

    expect(summary.totalConfiguredSymbols).toBe(4);
    expect(summary.freshCount).toBe(1);
    expect(summary.insufficientCount).toBe(1);
    expect(summary.derivedCount).toBe(1);
    expect(summary.placeholderCount).toBe(1);
    expect(summary.highImpactIssues).toEqual([
      expect.objectContaining({ symbol: "CNY=X", status: "insufficient", affectedScores: ["dollar_score"] }),
    ]);
  });

  test("rows sort missing insufficient stale and decaying before fresh derived and placeholder", () => {
    const configuredSymbols = collectConfiguredSymbolUsage().filter((item) => ["VIXCLS", "CNY=X", "DX-Y.NYB", "JPY=X", "GOLD_SILVER_RATIO", "CHINA_M2"].includes(item.symbol));
    const rows = buildCoverageRows({
      configuredSymbols,
      dbStats: [
        { symbol: "CNY=X", observationCount: 8, firstDate: "2026-06-01", latestDate: "2026-06-10" },
        { symbol: "DX-Y.NYB", observationCount: 100, firstDate: "2025-01-01", latestDate: "2026-06-01" },
        { symbol: "JPY=X", observationCount: 100, firstDate: "2025-01-01", latestDate: "2026-06-14" },
      ],
      now: new Date("2026-06-15T00:00:00Z"),
    });

    expect(rows.map((row) => row.status).slice(0, 3)).toEqual(["missing", "insufficient", "stale"]);
    expect(rows.at(-2)?.status).toBe("derived");
    expect(rows.at(-1)?.status).toBe("placeholder");
  });

  test("monthly macro data at 78 days is decaying and not a high impact issue", () => {
    const configuredSymbols = collectConfiguredSymbolUsage().filter((item) => ["JTSJOL", "PCEPI", "PCEPILFE"].includes(item.symbol));
    const rows = buildCoverageRows({
      configuredSymbols,
      dbStats: [
        { symbol: "JTSJOL", observationCount: 120, firstDate: "2016-01-01", latestDate: "2026-03-29" },
        { symbol: "PCEPI", observationCount: 120, firstDate: "2016-01-01", latestDate: "2026-03-29" },
        { symbol: "PCEPILFE", observationCount: 120, firstDate: "2016-01-01", latestDate: "2026-03-29" },
      ],
      now: new Date("2026-06-15T00:00:00Z"),
    });
    const summary = buildCoverageSummary(rows);

    expect(rows.map((row) => row.status)).toEqual(["decaying", "decaying", "decaying"]);
    expect(summary.decayingCount).toBe(3);
    expect(summary.staleCount).toBe(0);
    expect(summary.highImpactIssues).toEqual([]);
  });

  test("createDataCoverageDebugPayload adds warnings for missing insufficient decaying stale and CNY=X", () => {
    const configuredSymbols = collectConfiguredSymbolUsage().filter((item) => ["VIXCLS", "CNY=X", "DX-Y.NYB", "PCEPI"].includes(item.symbol));
    const payload = createDataCoverageDebugPayload({
      configuredSymbols,
      dbStats: [
        { symbol: "CNY=X", observationCount: 8, firstDate: "2026-06-01", latestDate: "2026-06-10" },
        { symbol: "DX-Y.NYB", observationCount: 100, firstDate: "2025-01-01", latestDate: "2026-06-01" },
        { symbol: "PCEPI", observationCount: 120, firstDate: "2016-01-01", latestDate: "2026-03-29" },
      ],
      now: new Date("2026-06-15T00:00:00Z"),
    });

    expect(payload.engineVersion).toBe("data-coverage-debug");
    expect(payload.warnings).toContain("Some configured symbols have no observations in database.");
    expect(payload.warnings).toContain("Some configured symbols have insufficient observations.");
    expect(payload.warnings).toContain("Some configured symbols are decaying based on frequency-aware freshness policy.");
    expect(payload.warnings).toContain("Some configured symbols are stale based on frequency-aware freshness policy.");
    expect(payload.warnings).toContain("CNY=X has insufficient observations and may weaken dollar_score diagnostics.");
  });

  test("collectConfiguredSymbolUsage uses CNY=X instead of CNH=X for dollar score", () => {
    const symbols = collectConfiguredSymbolUsage();
    const cny = symbols.find((item) => item.symbol === "CNY=X");

    expect(cny?.usages.map((usage) => usage.scoreKey)).toContain("dollar_score");
    expect(symbols.find((item) => item.symbol === "CNH=X")).toBeUndefined();
  });

  test("includes NFCI benchmark symbols as weekly benchmark diagnostics", () => {
    const symbols = collectConfiguredSymbolUsage();
    const nfci = symbols.find((item) => item.symbol === "NFCI");

    expect(nfci).toMatchObject({
      symbol: "NFCI",
      source: "FRED",
      frequency: "weekly",
      signalTransform: "level",
      minObservations: 30,
    });
    expect(nfci?.usages).toEqual([]);
  });

  test("NFCI weekly freshness policy is applied and not treated as placeholder", () => {
    const configuredSymbols = collectConfiguredSymbolUsage().filter((item) => item.symbol === "NFCI");
    const rows = buildCoverageRows({
      configuredSymbols,
      dbStats: [{ symbol: "NFCI", observationCount: 100, firstDate: "2024-01-01", latestDate: "2026-06-01" }],
      now: new Date("2026-06-15T00:00:00Z"),
    });

    expect(rows[0]).toMatchObject({
      symbol: "NFCI",
      status: "carried_forward",
      freshnessStatus: "carried_forward",
      affectedScores: [],
    });
  });

  test("missing NFCI is a benchmark data warning, not a score high impact issue", () => {
    const configuredSymbols = collectConfiguredSymbolUsage().filter((item) => item.symbol === "NFCI");
    const rows = buildCoverageRows({
      configuredSymbols,
      dbStats: [],
      now: new Date("2026-06-15T00:00:00Z"),
    });
    const summary = buildCoverageSummary(rows);

    expect(rows[0]).toMatchObject({
      symbol: "NFCI",
      status: "missing",
      affectedScores: [],
    });
    expect(rows[0].message).toContain("benchmark data is missing");
    expect(summary.highImpactIssues).toEqual([]);
  });
});
