import Link from "next/link";
import { CategoryFilter } from "@/components/CategoryFilter";
import { getIndicatorStats } from "@/lib/dashboardData";
import { formatChange, formatNumber, trendLabel } from "@/lib/format";

export default async function IndicatorsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const params = await searchParams;
  const activeCategory = params.category;
  const stats = await getIndicatorStats();
  const filtered = activeCategory ? stats.filter((item) => item.indicator.category === activeCategory) : stats;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Indicators 指標</h1>
          <p className="mt-2 text-sm text-slate-500">全部宏觀、市場、信用、商品和中國週期指標。</p>
        </div>
        <CategoryFilter active={activeCategory} />
      </div>

      <div className="panel overflow-hidden rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-white/[0.03] text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3">名稱</th>
                <th className="px-4 py-3">分類</th>
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
              {filtered.map((item) => (
                <tr key={item.indicator.id} className="border-t border-white/10 hover:bg-white/[0.025]">
                  <td className="px-4 py-3">
                    <Link href={`/indicators/${item.indicator.symbol}`} className="font-medium text-white hover:text-market-teal">
                      {item.indicator.name}
                      <span className="ml-2 mono text-xs text-slate-500">{item.indicator.symbol}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{item.indicator.category}</td>
                  <td className="px-4 py-3 text-slate-300">{formatNumber(item.latestValue)}</td>
                  <td className="px-4 py-3 text-slate-300">{formatChange(item.change1d)}</td>
                  <td className="px-4 py-3 text-slate-300">{formatChange(item.change7d)}</td>
                  <td className="px-4 py-3 text-slate-300">{formatChange(item.change30d)}</td>
                  <td className="px-4 py-3 text-slate-300">{formatChange(item.change90d)}</td>
                  <td className="px-4 py-3 text-slate-300">{formatNumber(item.zScore)}</td>
                  <td className="px-4 py-3 text-slate-300">{item.percentile === null ? "暫無" : `${formatNumber(item.percentile, 1)}%`}</td>
                  <td className="px-4 py-3 text-slate-300">{trendLabel(item.trend)}</td>
                  <td className="max-w-[360px] px-4 py-3 text-slate-500">{item.macroMeaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
