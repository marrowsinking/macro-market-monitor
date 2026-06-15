import { describe, expect, test } from "vitest";
import type { IndicatorStats, Trend } from "@/lib/calculateIndicators";
import {
  defaultIndicatorFilters,
  filterAndSortIndicators,
  hasActiveIndicatorFilters,
  parseIndicatorFilters,
} from "@/lib/indicators/filterIndicators";

function stat(
  id: number,
  values: {
    name: string;
    symbol: string;
    category?: string;
    source?: string;
    latestValue?: number | null;
    change30d?: number | null;
    trend?: Trend;
    description?: string;
    macroLogic?: string;
  },
): IndicatorStats {
  return {
    indicator: {
      id,
      name: values.name,
      symbol: values.symbol,
      category: values.category ?? "利率",
      source: values.source ?? "FRED",
      fredSeriesId: null,
      frequency: "daily",
      description: values.description ?? "",
      macroLogic: values.macroLogic ?? "",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      observations: [],
    },
    latestValue: values.latestValue ?? null,
    latestDate: values.latestValue === null ? null : new Date("2026-06-01T00:00:00.000Z"),
    previousValue: null,
    change1d: null,
    change7d: null,
    change30d: values.change30d ?? null,
    change90d: null,
    zScore: null,
    percentile: null,
    trend: values.trend ?? "insufficient_data",
    macroMeaning: values.macroLogic ?? "",
  };
}

const sampleStats = [
  stat(1, { name: "10-Year Treasury Yield", symbol: "DGS10", latestValue: 4.5, change30d: 0.25, trend: "rising", macroLogic: "長端利率壓力" }),
  stat(2, { name: "美元指數", symbol: "DX-Y.NYB", category: "美元", source: "YAHOO", latestValue: 105, change30d: 3.2, trend: "rising", description: "美元一籃子指數" }),
  stat(3, { name: "China PMI", symbol: "CHINA_PMI", category: "中國", source: "PLACEHOLDER", latestValue: null, change30d: null, trend: "insufficient_data", macroLogic: "中國增長" }),
  stat(4, { name: "VIX", symbol: "VIXCLS", category: "風險資產", latestValue: 14, change30d: -2, trend: "falling" }),
  stat(5, { name: "DXY placeholder", symbol: "DXY", category: "美元", source: "PLACEHOLDER", latestValue: null, change30d: null, trend: "insufficient_data" }),
];

describe("filterAndSortIndicators", () => {
  test("shows active indicators in the default list", () => {
    const result = filterAndSortIndicators(sampleStats, defaultIndicatorFilters);

    expect(result.map((item) => item.indicator.symbol)).toContain("DGS10");
    expect(result.map((item) => item.indicator.symbol)).toContain("DX-Y.NYB");
  });

  test("hides deprecated indicators from the default list", () => {
    const result = filterAndSortIndicators(sampleStats, defaultIndicatorFilters);

    expect(result.map((item) => item.indicator.symbol)).not.toContain("DXY");
  });

  test("shows China placeholders when the China category is selected", () => {
    const result = filterAndSortIndicators(sampleStats, { ...defaultIndicatorFilters, category: "中國" });

    expect(result.map((item) => item.indicator.symbol)).toEqual(["CHINA_PMI"]);
  });

  test("filters withData to indicators with a valid latestValue", () => {
    const result = filterAndSortIndicators(sampleStats, { ...defaultIndicatorFilters, dataStatus: "withData" });

    expect(result.map((item) => item.indicator.symbol)).toEqual(["DGS10", "DX-Y.NYB", "VIXCLS"]);
  });

  test("searches by symbol, name, description, and macro logic", () => {
    expect(filterAndSortIndicators(sampleStats, { ...defaultIndicatorFilters, search: "dgs" }).map((item) => item.indicator.symbol)).toEqual(["DGS10"]);
    expect(filterAndSortIndicators(sampleStats, { ...defaultIndicatorFilters, search: "一籃子" }).map((item) => item.indicator.symbol)).toEqual(["DX-Y.NYB"]);
    expect(filterAndSortIndicators(sampleStats, { ...defaultIndicatorFilters, category: "中國", search: "中國增長" }).map((item) => item.indicator.symbol)).toEqual(["CHINA_PMI"]);
  });

  test("sorts by change30d descending", () => {
    const result = filterAndSortIndicators(sampleStats, { ...defaultIndicatorFilters, sort: "change30d", order: "desc" });

    expect(result.map((item) => item.indicator.symbol)).toEqual(["DX-Y.NYB", "DGS10", "VIXCLS"]);
  });

  test("parses cleared filters back to defaults", () => {
    const filters = parseIndicatorFilters({
      category: "all",
      search: "",
      data: "all",
      trend: "all",
      source: "all",
      purpose: "all",
      status: "active",
      sort: "default",
      order: "asc",
    });

    expect(filters).toEqual(defaultIndicatorFilters);
    expect(hasActiveIndicatorFilters(filters)).toBe(false);
  });

  test("returns an empty result when nothing matches", () => {
    const result = filterAndSortIndicators(sampleStats, { ...defaultIndicatorFilters, search: "no-match" });

    expect(result).toEqual([]);
  });
});
