import type { IndicatorStats } from "@/lib/calculateIndicators";
import { getIndicatorVisibility, isDefaultIndicatorVisible } from "@/lib/indicators/indicatorVisibility";

export type DataStatusFilter = "all" | "withData" | "withoutData";
export type TrendFilter = "all" | "rising" | "falling" | "mixed" | "insufficient_data";
export type SourceFilter = "all" | "FRED" | "YAHOO" | "MANUAL" | "PLACEHOLDER";
export type PurposeFilter = "all" | "scoreInput" | "core" | "placeholder" | "inactive";
export type StatusFilter = "active" | "placeholder" | "disabled" | "deprecated" | "all";
export type IndicatorSortKey =
  | "default"
  | "name"
  | "category"
  | "latestValue"
  | "change1d"
  | "change7d"
  | "change30d"
  | "change90d"
  | "zScore"
  | "percentile"
  | "trend"
  | "dataStatus";
export type SortOrder = "asc" | "desc";

export type IndicatorFilterState = {
  category: string;
  search: string;
  dataStatus: DataStatusFilter;
  trend: TrendFilter;
  source: SourceFilter;
  purpose: PurposeFilter;
  status: StatusFilter;
  sort: IndicatorSortKey;
  order: SortOrder;
};

export const defaultIndicatorFilters: IndicatorFilterState = {
  category: "all",
  search: "",
  dataStatus: "all",
  trend: "all",
  source: "all",
  purpose: "all",
  status: "active",
  sort: "default",
  order: "asc",
};

type RawParams = {
  category?: string;
  search?: string;
  data?: string;
  trend?: string;
  source?: string;
  purpose?: string;
  status?: string;
  sort?: string;
  order?: string;
};

const dataValues = new Set(["all", "withData", "withoutData"]);
const trendValues = new Set(["all", "rising", "falling", "mixed", "insufficient_data"]);
const sourceValues = new Set(["all", "FRED", "YAHOO", "MANUAL", "PLACEHOLDER"]);
const purposeValues = new Set(["all", "scoreInput", "core", "placeholder", "inactive"]);
const statusValues = new Set(["active", "placeholder", "disabled", "deprecated", "all"]);
const sortValues = new Set(["default", "name", "category", "latestValue", "change1d", "change7d", "change30d", "change90d", "zScore", "percentile", "trend", "dataStatus"]);

export function parseIndicatorFilters(params: RawParams): IndicatorFilterState {
  return {
    category: params.category && params.category !== "all" ? params.category : "all",
    search: params.search?.trim() ?? "",
    dataStatus: dataValues.has(params.data ?? "") ? (params.data as DataStatusFilter) : "all",
    trend: trendValues.has(params.trend ?? "") ? (params.trend as TrendFilter) : "all",
    source: sourceValues.has(params.source ?? "") ? (params.source as SourceFilter) : "all",
    purpose: purposeValues.has(params.purpose ?? "") ? (params.purpose as PurposeFilter) : "all",
    status: statusValues.has(params.status ?? "") ? (params.status as StatusFilter) : "active",
    sort: sortValues.has(params.sort ?? "") ? (params.sort as IndicatorSortKey) : "default",
    order: params.order === "desc" ? "desc" : "asc",
  };
}

export function hasActiveIndicatorFilters(filters: IndicatorFilterState): boolean {
  return (
    filters.category !== "all" ||
    filters.search !== "" ||
    filters.dataStatus !== "all" ||
    filters.trend !== "all" ||
    filters.source !== "all" ||
    filters.purpose !== "all" ||
    filters.status !== "active" ||
    filters.sort !== "default" ||
    filters.order !== "asc"
  );
}

function hasData(item: IndicatorStats): boolean {
  return item.latestValue !== null && item.latestValue !== undefined && Number.isFinite(item.latestValue);
}

function searchHaystack(item: IndicatorStats): string {
  return [
    item.indicator.name,
    item.indicator.symbol,
    item.indicator.description,
    item.indicator.macroLogic,
  ].join(" ").toLowerCase();
}

function numericValue(item: IndicatorStats, key: IndicatorSortKey): number | null {
  if (key === "latestValue") return item.latestValue;
  if (key === "change1d") return item.change1d;
  if (key === "change7d") return item.change7d;
  if (key === "change30d") return item.change30d;
  if (key === "change90d") return item.change90d;
  if (key === "zScore") return item.zScore;
  if (key === "percentile") return item.percentile;
  return null;
}

function compareNullableNumber(a: number | null, b: number | null, order: SortOrder): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return order === "desc" ? b - a : a - b;
}

function compareString(a: string, b: string): number {
  return a.localeCompare(b, "zh-Hant");
}

function compareBySort(a: IndicatorStats, b: IndicatorStats, sort: IndicatorSortKey, order: SortOrder): number {
  if (sort === "default") return order === "desc" ? b.indicator.id - a.indicator.id : a.indicator.id - b.indicator.id;
  if (sort === "name") return order === "desc" ? compareString(b.indicator.name, a.indicator.name) : compareString(a.indicator.name, b.indicator.name);
  if (sort === "category") {
    const comparison = compareString(a.indicator.category, b.indicator.category) || compareString(a.indicator.symbol, b.indicator.symbol);
    return order === "desc" ? -comparison : comparison;
  }
  if (sort === "trend") return order === "desc" ? compareString(b.trend, a.trend) : compareString(a.trend, b.trend);
  if (sort === "dataStatus") {
    const comparison = Number(hasData(a)) - Number(hasData(b));
    return order === "desc" ? -comparison : comparison;
  }
  return compareNullableNumber(numericValue(a, sort), numericValue(b, sort), order);
}

export function filterAndSortIndicators(stats: IndicatorStats[], filters: IndicatorFilterState): IndicatorStats[] {
  const needle = filters.search.toLowerCase();
  const filtered = stats.filter((item) => {
    const visibility = getIndicatorVisibility(item.indicator);
    if (filters.category !== "all" && item.indicator.category !== filters.category) return false;
    if (filters.status === "active" && !isDefaultIndicatorVisible(item.indicator, filters.category)) return false;
    if (filters.status !== "active" && filters.status !== "all" && visibility.status !== filters.status) return false;
    if (filters.purpose === "scoreInput" && !visibility.isScoreInput) return false;
    if (filters.purpose === "core" && !visibility.isCoreIndicator) return false;
    if (filters.purpose === "placeholder" && visibility.status !== "placeholder") return false;
    if (filters.purpose === "inactive" && visibility.status !== "disabled" && visibility.status !== "deprecated") return false;
    if (filters.dataStatus === "withData" && !hasData(item)) return false;
    if (filters.dataStatus === "withoutData" && hasData(item)) return false;
    if (filters.trend !== "all" && item.trend !== filters.trend) return false;
    if (filters.source !== "all" && item.indicator.source !== filters.source) return false;
    if (needle && !searchHaystack(item).includes(needle)) return false;
    return true;
  });

  return filtered.sort((a, b) => {
    return compareBySort(a, b, filters.sort, filters.order);
  });
}
