import Link from "next/link";
import { CategoryFilter } from "@/components/CategoryFilter";
import { IndicatorFilters } from "@/components/IndicatorFilters";
import { getIndicatorStats } from "@/lib/dashboardData";
import { formatChange, formatNumber, trendLabel } from "@/lib/format";
import { filterAndSortIndicators, hasActiveIndicatorFilters, parseIndicatorFilters } from "@/lib/indicators/filterIndicators";
import { indicatorDetailHref } from "@/lib/indicators/indicatorRoutes";
import { getIndicatorVisibility } from "@/lib/indicators/indicatorVisibility";

type SearchParams = {
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

function paramsRecord(params: SearchParams): Record<string, string> {
  return Object.fromEntries(Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== ""));
}

function changeTone(value: number | null): string {
  if (value === null) return "text-slate-500";
  if (value > 0) return "text-emerald-300";
  if (value < 0) return "text-red-300";
  return "text-slate-500";
}

function trendTone(trend: string): string {
  if (trend === "rising") return "text-emerald-300";
  if (trend === "falling") return "text-red-300";
  if (trend === "mixed") return "text-amber-300";
  return "text-slate-500";
}

function statusBadge(status: string, replacedBy: string | null): string {
  if (status === "active") return "active";
  if (status === "placeholder") return "未接入";
  if (status === "disabled") return "已停用";
  if (status === "deprecated") return replacedBy ? `已替代 -> ${replacedBy}` : "已替代";
  return status;
}

function statusTone(status: string): string {
  if (status === "active") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === "placeholder") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (status === "deprecated") return "border-slate-500/30 bg-slate-500/10 text-slate-400";
  return "border-red-500/30 bg-red-500/10 text-red-300";
}

export default async function IndicatorsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = parseIndicatorFilters(params);
  const stats = await getIndicatorStats();
  const filtered = filterAndSortIndicators(stats, filters);
  const activeFilters = hasActiveIndicatorFilters(filters);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Indicators 指標</h1>
          <p className="mt-2 text-sm text-slate-500">全部宏觀、市場、信用、商品和中國週期指標。</p>
        </div>
      </div>

      <CategoryFilter active={filters.category} params={paramsRecord(params)} />
      {filters.category === "中國" ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          中國宏觀數據尚未接入，目前僅作後續擴展佔位。
        </div>
      ) : null}
      <IndicatorFilters filters={filters} />

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="text-slate-400">
          顯示 <span className="font-semibold text-white">{filtered.length}</span> / {stats.length} 個指標
          {activeFilters ? <span className="ml-2 rounded-md bg-market-teal/10 px-2 py-1 text-xs text-market-teal">已套用篩選</span> : null}
        </div>
        {activeFilters ? (
          <Link href="/indicators" className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:border-market-teal/50 hover:text-market-teal">
            清除篩選
          </Link>
        ) : null}
      </div>

      <div className="panel overflow-hidden rounded-lg">
        {filtered.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center p-8 text-center">
            <div className="text-base font-semibold text-white">沒有符合條件的指標</div>
            <div className="mt-2 text-sm text-slate-500">請嘗試清除篩選或切換分類</div>
            <Link href="/indicators" className="mt-4 rounded-md border border-market-teal/40 bg-market-teal/10 px-3 py-2 text-sm text-market-teal hover:bg-market-teal/15">
              清除篩選
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-white/[0.03] text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3">名稱</th>
                  <th className="px-4 py-3">分類</th>
                  <th className="px-4 py-3">狀態</th>
                  <th className="px-4 py-3">最新值</th>
                  <th className="px-4 py-3">1日</th>
                  <th className="px-4 py-3">7日</th>
                  <th className="px-4 py-3">30日</th>
                  <th className="px-4 py-3">90日</th>
                  <th className="px-4 py-3">Z-score</th>
                  <th className="px-4 py-3">分位數</th>
                  <th className="px-4 py-3">趨勢</th>
                  <th className="px-4 py-3">宏觀含義</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const visibility = getIndicatorVisibility(item.indicator);
                  const hasData = item.latestValue !== null && item.latestValue !== undefined;
                  const macroMeaning = visibility.status === "deprecated" && visibility.replacedBy
                    ? `已由 ${visibility.replacedBy} 替代，預設不參與顯示。`
                    : item.macroMeaning;
                  return (
                    <tr key={item.indicator.id} className={`border-t border-white/10 hover:bg-white/[0.025] ${hasData && visibility.status === "active" ? "" : "text-slate-500"}`}>
                      <td className="px-4 py-3">
                        <Link href={indicatorDetailHref(item.indicator)} className={`font-medium hover:text-market-teal ${hasData && visibility.status === "active" ? "text-white" : "text-slate-500"}`}>
                          {item.indicator.name}
                          <span className="ml-2 mono text-xs text-slate-500">{item.indicator.symbol}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{item.indicator.category}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusTone(visibility.status)}`}>
                          {statusBadge(visibility.status, visibility.replacedBy)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{formatNumber(item.latestValue)}</td>
                      <td className={`px-4 py-3 ${changeTone(item.change1d)}`}>{formatChange(item.change1d)}</td>
                      <td className={`px-4 py-3 ${changeTone(item.change7d)}`}>{formatChange(item.change7d)}</td>
                      <td className={`px-4 py-3 ${changeTone(item.change30d)}`}>{formatChange(item.change30d)}</td>
                      <td className={`px-4 py-3 ${changeTone(item.change90d)}`}>{formatChange(item.change90d)}</td>
                      <td className="px-4 py-3 text-slate-300">{formatNumber(item.zScore)}</td>
                      <td className="px-4 py-3 text-slate-300">{item.percentile === null ? "暫無" : `${formatNumber(item.percentile, 1)}%`}</td>
                      <td className={`px-4 py-3 ${trendTone(item.trend)}`}>{trendLabel(item.trend)}</td>
                      <td className="max-w-[360px] px-4 py-3 text-slate-500">{macroMeaning}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
