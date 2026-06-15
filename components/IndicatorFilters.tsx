"use client";

import { useRouter } from "next/navigation";
import type { IndicatorFilterState, SortOrder } from "@/lib/indicators/filterIndicators";

const dataOptions = [
  ["all", "全部"],
  ["withData", "有數據"],
  ["withoutData", "暫無數據"],
] as const;

const trendOptions = [
  ["all", "全部"],
  ["rising", "上升"],
  ["falling", "下降"],
  ["mixed", "混合"],
  ["insufficient_data", "數據不足"],
] as const;

const sourceOptions = [
  ["all", "全部"],
  ["FRED", "FRED"],
  ["YAHOO", "YAHOO"],
  ["MANUAL", "MANUAL"],
  ["PLACEHOLDER", "PLACEHOLDER"],
] as const;

const purposeOptions = [
  ["all", "全部用途"],
  ["scoreInput", "參與計分"],
  ["core", "核心觀察"],
  ["placeholder", "未接入佔位"],
  ["inactive", "已停用 / 已替代"],
] as const;

const statusOptions = [
  ["active", "Active"],
  ["placeholder", "Placeholder"],
  ["disabled", "Disabled"],
  ["deprecated", "Deprecated"],
  ["all", "全部狀態"],
] as const;

const sortOptions = [
  ["default", "預設排序"],
  ["name", "名稱"],
  ["category", "分類"],
  ["latestValue", "最新值"],
  ["change1d", "1日變化"],
  ["change7d", "7日變化"],
  ["change30d", "30日變化"],
  ["change90d", "90日變化"],
  ["zScore", "Z-score"],
  ["percentile", "分位數"],
  ["trend", "趨勢"],
  ["dataStatus", "數據狀態"],
] as const;

function queryFrom(filters: IndicatorFilterState, overrides: Partial<IndicatorFilterState>): string {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (next.category !== "all") params.set("category", next.category);
  if (next.search) params.set("search", next.search);
  if (next.dataStatus !== "all") params.set("data", next.dataStatus);
  if (next.trend !== "all") params.set("trend", next.trend);
  if (next.source !== "all") params.set("source", next.source);
  if (next.purpose !== "all") params.set("purpose", next.purpose);
  if (next.status !== "active") params.set("status", next.status);
  if (next.sort !== "default") params.set("sort", next.sort);
  if (next.order !== "asc") params.set("order", next.order);
  const query = params.toString();
  return query ? `/indicators?${query}` : "/indicators";
}

export function IndicatorFilters({ filters }: { filters: IndicatorFilterState }) {
  const router = useRouter();

  function update(overrides: Partial<IndicatorFilterState>) {
    router.replace(queryFrom(filters, overrides));
  }

  return (
    <div className="panel rounded-lg p-4">
      <div className="grid gap-3 lg:grid-cols-[1.3fr_repeat(6,0.8fr)_auto_auto]">
        <input
          value={filters.search}
          onChange={(event) => update({ search: event.target.value })}
          placeholder="搜尋名稱或 symbol"
          className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-market-teal/50"
        />
        <select value={filters.dataStatus} onChange={(event) => update({ dataStatus: event.target.value as IndicatorFilterState["dataStatus"] })} className="rounded-md border border-white/10 bg-ink-900 px-3 py-2 text-sm text-slate-300">
          {dataOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={filters.trend} onChange={(event) => update({ trend: event.target.value as IndicatorFilterState["trend"] })} className="rounded-md border border-white/10 bg-ink-900 px-3 py-2 text-sm text-slate-300">
          {trendOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={filters.source} onChange={(event) => update({ source: event.target.value as IndicatorFilterState["source"] })} className="rounded-md border border-white/10 bg-ink-900 px-3 py-2 text-sm text-slate-300">
          {sourceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={filters.purpose} onChange={(event) => update({ purpose: event.target.value as IndicatorFilterState["purpose"] })} className="rounded-md border border-white/10 bg-ink-900 px-3 py-2 text-sm text-slate-300">
          {purposeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={filters.status} onChange={(event) => update({ status: event.target.value as IndicatorFilterState["status"] })} className="rounded-md border border-white/10 bg-ink-900 px-3 py-2 text-sm text-slate-300">
          {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={filters.sort} onChange={(event) => update({ sort: event.target.value as IndicatorFilterState["sort"] })} className="rounded-md border border-white/10 bg-ink-900 px-3 py-2 text-sm text-slate-300">
          {sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button type="button" onClick={() => update({ order: filters.order === "asc" ? "desc" : "asc" })} className="rounded-md border border-white/10 px-3 py-2 text-sm text-slate-300 hover:border-market-teal/50 hover:text-market-teal">
          {filters.order === "asc" ? "升序 ↑" : "降序 ↓"}
        </button>
        <button type="button" onClick={() => update({ dataStatus: "withData" })} className="rounded-md border border-market-teal/40 bg-market-teal/10 px-3 py-2 text-sm text-market-teal hover:bg-market-teal/15">
          只看有數據
        </button>
      </div>
    </div>
  );
}
