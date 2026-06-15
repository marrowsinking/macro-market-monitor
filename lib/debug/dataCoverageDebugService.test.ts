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

  test("daily market data older than 10 days is stale", () => {
    const configuredSymbols = collectConfiguredSymbolUsage().filter((item) => item.symbol === "DX-Y.NYB");
    const rows = buildCoverageRows({
      configuredSymbols,
      dbStats: [{ symbol: "DX-Y.NYB", observationCount: 100, firstDate: "2025-01-01", latestDate: "2026-06-01" }],
      now: new Date("2026-06-15T00:00:00Z"),
    });

    expect(rows[0].status).toBe("stale");
    expect(rows[0].daysSinceLatest).toBe(14);
  });

  test("monthly macro data inside 75 days is ok when observation count is sufficient", () => {
    const configuredSymbols = collectConfiguredSymbolUsage().filter((item) => item.symbol === "CPIAUCSL");
    const rows = buildCoverageRows({
      configuredSymbols,
      dbStats: [{ symbol: "CPIAUCSL", observationCount: 120, firstDate: "2016-01-01", latestDate: "2026-05-01" }],
      now: new Date("2026-06-15T00:00:00Z"),
    });

    expect(rows[0].status).toBe("ok");
    expect(rows[0].daysSinceLatest).toBe(45);
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
    expect(summary.okCount).toBe(1);
    expect(summary.insufficientCount).toBe(1);
    expect(summary.derivedCount).toBe(1);
    expect(summary.placeholderCount).toBe(1);
    expect(summary.highImpactIssues).toEqual([
      expect.objectContaining({ symbol: "CNY=X", status: "insufficient", affectedScores: ["dollar_score"] }),
    ]);
  });

  test("rows sort missing insufficient and stale before ok derived and placeholder", () => {
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

  test("createDataCoverageDebugPayload adds warnings for missing insufficient stale and CNY=X", () => {
    const configuredSymbols = collectConfiguredSymbolUsage().filter((item) => ["VIXCLS", "CNY=X", "DX-Y.NYB"].includes(item.symbol));
    const payload = createDataCoverageDebugPayload({
      configuredSymbols,
      dbStats: [
        { symbol: "CNY=X", observationCount: 8, firstDate: "2026-06-01", latestDate: "2026-06-10" },
        { symbol: "DX-Y.NYB", observationCount: 100, firstDate: "2025-01-01", latestDate: "2026-06-01" },
      ],
      now: new Date("2026-06-15T00:00:00Z"),
    });

    expect(payload.engineVersion).toBe("data-coverage-debug");
    expect(payload.warnings).toContain("Some configured symbols have no observations in database.");
    expect(payload.warnings).toContain("Some configured symbols have insufficient observations.");
    expect(payload.warnings).toContain("Some configured symbols have stale observations.");
    expect(payload.warnings).toContain("CNY=X has insufficient observations and may weaken dollar_score diagnostics.");
  });

  test("collectConfiguredSymbolUsage uses CNY=X instead of CNH=X for dollar score", () => {
    const symbols = collectConfiguredSymbolUsage();
    const cny = symbols.find((item) => item.symbol === "CNY=X");

    expect(cny?.usages.map((usage) => usage.scoreKey)).toContain("dollar_score");
    expect(symbols.find((item) => item.symbol === "CNH=X")).toBeUndefined();
  });
});
