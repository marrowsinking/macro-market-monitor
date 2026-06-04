import Link from "next/link";
import { notFound } from "next/navigation";
import { IndicatorChart } from "@/components/IndicatorChart";
import { getIndicatorDetail } from "@/lib/dashboardData";
import { formatChange, formatDate, formatNumber, trendLabel } from "@/lib/format";

export default async function IndicatorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { symbol } = await params;
  const query = await searchParams;
  const years = query.range === "3y" ? 3 : query.range === "5y" ? 5 : 1;
  const detail = await getIndicatorDetail(symbol, years);
  if (!detail) notFound();

  const chartData = detail.indicator.observations.map((item) => ({
    date: item.date.toISOString().slice(0, 10),
    value: item.value,
  }));

  const ranges = [
    { label: "1年", value: "1y" },
    { label: "3年", value: "3y" },
    { label: "5年", value: "5y" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/indicators" className="text-sm text-slate-500 hover:text-market-teal">返回 Indicators</Link>
          <h1 className="mt-2 text-2xl font-semibold">{detail.indicator.name}</h1>
          <p className="mt-2 text-sm text-slate-500">
            <span className="mono">{detail.indicator.symbol}</span> · {detail.indicator.category} · {detail.indicator.source}
          </p>
        </div>
        <div className="flex gap-2">
          {ranges.map((range) => (
            <Link
              key={range.value}
              href={`/indicators/${detail.indicator.symbol}?range=${range.value}`}
              className={`rounded-md border px-3 py-1.5 text-sm ${years === Number(range.value[0]) ? "border-market-teal/60 bg-market-teal/10 text-market-teal" : "border-white/10 text-slate-400 hover:text-white"}`}
            >
              {range.label}
            </Link>
          ))}
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="panel rounded-lg p-4">
          <div className="text-xs text-slate-500">最新值</div>
          <div className="mt-3 text-2xl font-semibold">{formatNumber(detail.stat.latestValue)}</div>
        </div>
        <div className="panel rounded-lg p-4">
          <div className="text-xs text-slate-500">日期</div>
          <div className="mt-3 text-2xl font-semibold">{formatDate(detail.stat.latestDate)}</div>
        </div>
        <div className="panel rounded-lg p-4">
          <div className="text-xs text-slate-500">30日變化</div>
          <div className="mt-3 text-2xl font-semibold">{formatChange(detail.stat.change30d)}</div>
        </div>
        <div className="panel rounded-lg p-4">
          <div className="text-xs text-slate-500">趨勢</div>
          <div className="mt-3 text-2xl font-semibold">{trendLabel(detail.stat.trend)}</div>
        </div>
      </section>

      <section className="panel rounded-lg p-5">
        <IndicatorChart data={chartData} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel rounded-lg p-5">
          <h2 className="text-lg font-semibold">中文解讀</h2>
          <p className="mt-3 leading-8 text-slate-300">{detail.indicator.description}</p>
        </div>
        <div className="panel rounded-lg p-5">
          <h2 className="text-lg font-semibold">對宏觀 regime 的影響</h2>
          <p className="mt-3 leading-8 text-slate-300">{detail.indicator.macroLogic}</p>
        </div>
      </section>
    </div>
  );
}
