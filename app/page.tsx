import Link from "next/link";
import { AlertTriangle, ArrowRight, Database } from "lucide-react";
import { InsightPanel } from "@/components/InsightPanel";
import { IndicatorChart } from "@/components/IndicatorChart";
import { ScoreCard } from "@/components/ScoreCard";
import { UpdateDataButton } from "@/components/UpdateDataButton";
import type { ProviderFetchStatus } from "@/lib/dashboard/dashboardViewModel";
import { getDashboardViewModel } from "@/lib/dashboard/dashboardViewModel";
import { formatChange, formatDate, formatDateTime, formatNumber, trendLabel } from "@/lib/format";

function formatNewYorkDateTime(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

function shortErrorMessage(value: string | null): string {
  if (!value) return "暫無錯誤訊息";
  return value.length > 120 ? `${value.slice(0, 120)}...` : value;
}

function ProviderStatusRow({ status }: { status: ProviderFetchStatus }) {
  return (
    <div className="rounded-md border border-white/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">{status.provider}</div>
        <span
          className={`rounded-md px-2 py-1 text-xs ${
            status.status === "unknown" ? "bg-white/5 text-slate-400" : status.hasRecentFailure ? "bg-market-red/15 text-market-red" : "bg-market-green/10 text-market-green"
          }`}
        >
          {status.status === "unknown" ? "未知" : status.hasRecentFailure ? "最近有失敗" : "正常"}
        </span>
      </div>
      <div className="mt-2 text-xs leading-5 text-slate-400">最近成功：{formatDateTime(status.latestSuccessAt)}</div>
      {status.message ? <div className="mt-2 text-xs leading-5 text-slate-500">{status.message}</div> : null}
      {status.latestFailure ? (
        <div className="mt-2 rounded-md bg-market-red/8 p-2 text-xs leading-5 text-market-red">
          {status.latestFailure.provider} / {status.latestFailure.symbol} / {status.latestFailure.errorType ?? "UNKNOWN"}：{shortErrorMessage(status.latestFailure.errorMessage)}
        </div>
      ) : null}
    </div>
  );
}

export default async function DashboardPage() {
  const viewModel = await getDashboardViewModel();
  const {
    stats,
    regime,
    displayedRegime,
    insights,
    latestAlerts,
    chartSource,
    chartData,
    tableStats,
    fredKeyMissing,
    latestFredFetchResult,
    latestYahooFetchResult,
    lastSuccessfulUpdateTime,
    dataFreshnessStatus,
  } = viewModel;
  const regimeCreatedAt = regime?.createdAt ?? null;

  return (
    <div className="space-y-6">
      {fredKeyMissing ? (
        <div className="panel flex items-start gap-3 rounded-lg border-amber-400/30 bg-amber-400/8 p-4">
          <AlertTriangle className="mt-0.5 text-market-amber" size={18} />
          <div>
            <div className="text-sm font-semibold text-amber-100">FRED API Key 尚未設置</div>
            <div className="mt-1 text-sm text-amber-100/70">
              Dashboard 可以打開，但不會自動拉取 FRED 數據。到 Settings 填入 key，或在 `.env.local` 設置 `FRED_API_KEY`。
            </div>
          </div>
        </div>
      ) : null}

      {!regime ? (
        <div className="panel flex items-start gap-3 rounded-lg border-amber-400/30 bg-amber-400/8 p-4">
          <AlertTriangle className="mt-0.5 text-market-amber" size={18} />
          <div>
            <div className="text-sm font-semibold text-amber-100">尚未生成宏觀狀態</div>
            <div className="mt-1 text-sm text-amber-100/70">請先執行 `npm run fetch:fred` 和 `npm run calculate:regime`。</div>
          </div>
        </div>
      ) : null}

      {regimeCreatedAt ? (
        <div className={`panel rounded-lg p-4 text-sm ${dataFreshnessStatus.status === "FRESH" ? "text-slate-300" : "border-amber-400/30 bg-amber-400/8 text-amber-100"}`}>
          <div>最後更新時間：{formatDateTime(regimeCreatedAt)}（美國東部時間：{formatNewYorkDateTime(regimeCreatedAt)}）</div>
          {lastSuccessfulUpdateTime ? <div className="mt-1 text-slate-400">上次成功生成時間：{formatDateTime(lastSuccessfulUpdateTime)}</div> : null}
          {dataFreshnessStatus.message ? <div className="mt-1 text-amber-100/75">{dataFreshnessStatus.message}</div> : null}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="panel rounded-lg p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm text-slate-500">今日宏觀總狀態</div>
              <h1 className="mt-3 text-4xl font-semibold tracking-normal text-white">{displayedRegime.finalRegime}</h1>
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <UpdateDataButton />
              <Link href="/indicators" className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-slate-300 hover:border-market-teal/50 hover:text-market-teal">
                查看指標
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
          <p className="mt-5 max-w-4xl text-base leading-8 text-slate-300">{displayedRegime.summary}</p>
        </div>

        <div className="panel rounded-lg p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Database size={16} className="text-market-teal" />
            數據狀態
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border border-white/10 p-3">
              <div className="text-slate-500">已建指標</div>
              <div className="mt-2 text-2xl font-semibold">{stats.length}</div>
            </div>
            <div className="rounded-md border border-white/10 p-3">
              <div className="text-slate-500">有數據指標</div>
              <div className="mt-2 text-2xl font-semibold">{stats.filter((item) => item.latestValue !== null).length}</div>
            </div>
            <div className="col-span-2 rounded-md border border-white/10 p-3">
              <div className="text-slate-500">圖表基準</div>
              <div className="mt-2 text-lg font-semibold">{chartSource?.indicator.name ?? "暫無"}</div>
            </div>
            <div className="col-span-2 grid gap-3">
              <ProviderStatusRow status={latestFredFetchResult} />
              <ProviderStatusRow status={latestYahooFetchResult} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ScoreCard label="liquidity_score 流動性" value={displayedRegime.liquidityScore} hint="短端利率、美元、Fed 資產負債表與信用利差。" />
        <ScoreCard label="inflation_score 通脹" value={displayedRegime.inflationScore} hint="CPI、PCE、油價與長端收益率。" />
        <ScoreCard label="growth_score 增長" value={displayedRegime.growthScore} hint="非農、失業率、初請與 PMI。" />
        <ScoreCard label="risk_appetite_score 風險偏好" value={displayedRegime.riskAppetiteScore} hint="VIX、信用利差與股市佔位指標。" />
        <ScoreCard label="dollar_score 美元壓力" value={displayedRegime.dollarScore} hint="DXY、2Y yield、USDCNH。" />
        <ScoreCard label="credit_score 信用風險" value={displayedRegime.creditScore} hint="高收益利差和波動率。" />
        <ScoreCard label="commodity_score 商品週期" value={displayedRegime.commodityScore} hint="原油、銅、金銀相對強弱。" />
        <ScoreCard label="china_score 中國宏觀" value={displayedRegime.chinaScore} hint="人民幣、PMI、社融、M2、權益資產。" />
      </section>

      <section className="panel rounded-lg p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">最新警報</h2>
            <div className="mt-1 text-xs text-slate-500">最近 3 條 high / medium alerts</div>
          </div>
          <Link href="/alerts" className="text-sm text-market-teal hover:text-market-teal/80">查看全部</Link>
        </div>
        {latestAlerts.length > 0 ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {latestAlerts.map((alert) => (
              <div key={alert.id} className="rounded-md border border-white/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-white">{alert.message.split("，")[0]}</span>
                  <span className={`rounded-md px-2 py-1 text-xs ${alert.severity === "high" ? "bg-market-red/15 text-market-red" : "bg-market-amber/15 text-market-amber"}`}>
                    {alert.severity}
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-500">{alert.indicator.symbol} · {formatDateTime(alert.triggeredAt)}</div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{alert.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-white/10 p-4 text-sm text-slate-400">目前沒有 high / medium 已觸發警報。</div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <InsightPanel title="主要支持因素" subtitle="Key Drivers" items={insights.keyDrivers} />
        <InsightPanel title="矛盾信號" subtitle="Conflicting Signals" items={insights.conflictingSignals} />
        <InsightPanel title="下一步觀察" subtitle="Watch Next" items={insights.watchNext} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="panel rounded-lg p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">核心趨勢圖</h2>
            <span className="text-xs text-slate-500">{chartSource?.indicator.symbol ?? "NO DATA"}</span>
          </div>
          <IndicatorChart data={chartData} />
        </div>

        <div className="panel overflow-hidden rounded-lg">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-lg font-semibold">早盤快速掃描</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-white/[0.03] text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3">指標</th>
                  <th className="px-4 py-3">最新</th>
                  <th className="px-4 py-3">日期</th>
                  <th className="px-4 py-3">30日</th>
                  <th className="px-4 py-3">趨勢</th>
                </tr>
              </thead>
              <tbody>
                {tableStats.map((item) =>
                  item ? (
                    <tr key={item.indicator.symbol} className="border-t border-white/10">
                      <td className="px-4 py-3 font-medium text-white">{item.indicator.symbol}</td>
                      <td className="px-4 py-3 text-slate-300">{formatNumber(item.latestValue)}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(item.latestDate)}</td>
                      <td className="px-4 py-3 text-slate-300">{formatChange(item.change30d)}</td>
                      <td className="px-4 py-3 text-slate-300">{trendLabel(item.trend)}</td>
                    </tr>
                  ) : null,
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
