import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { InsightPanel } from "@/components/InsightPanel";
import { IndicatorChart } from "@/components/IndicatorChart";
import { DashboardModeToggle } from "@/components/dashboard/DashboardModeToggle";
import { PlainLanguageCard } from "@/components/dashboard/PlainLanguageCard";
import { ScoreBreakdownAccordion } from "@/components/dashboard/ScoreBreakdownAccordion";
import { UpdateDataButton } from "@/components/UpdateDataButton";
import type { DashboardDataStatusProvider, ScoreChange, ScoreChanges } from "@/lib/dashboard/dashboardViewModel";
import { getDashboardViewModel } from "@/lib/dashboard/dashboardViewModel";
import { formatChange, formatDate, formatDateTime, formatNumber, trendLabel } from "@/lib/format";

function shortErrorMessage(value: string | null | undefined): string {
  if (!value) return "暫無錯誤訊息";
  return value.length > 120 ? `${value.slice(0, 120)}...` : value;
}

function compactText(value: string, maxLength = 170): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function statusLabel(status: DashboardDataStatusProvider["status"]): string {
  if (status === "partial") return "部分失敗";
  if (status === "failed") return "失敗";
  return "未知";
}

function providerBadgeClass(status: DashboardDataStatusProvider["status"]): string {
  if (status === "normal") return "bg-emerald-500/10 text-emerald-300";
  if (status === "failed") return "bg-red-500/10 text-red-300";
  return "bg-yellow-500/10 text-yellow-300";
}

function shouldShowProviderDetail(provider: DashboardDataStatusProvider, globalUpdatedAt: string | null): boolean {
  return provider.status !== "normal" || Boolean(provider.latestSuccessAt && globalUpdatedAt && provider.latestSuccessAt !== globalUpdatedAt);
}

function ProviderBadge({ provider }: { provider: DashboardDataStatusProvider }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${providerBadgeClass(provider.status)}`}>
      {provider.name} {provider.indicatorsWithDataCount}/{provider.indicatorCount}
    </span>
  );
}

type ScoreChangeKey = keyof ScoreChanges;

const scoreChangeMeta: Array<{ key: ScoreChangeKey; label: string; up: string; down: string }> = [
  { key: "liquidityScore", label: "流動性", up: "流動性邊際改善", down: "流動性邊際收緊" },
  { key: "inflationScore", label: "通脹壓力", up: "通脹壓力升高", down: "通脹壓力回落" },
  { key: "growthScore", label: "增長", up: "增長動能改善", down: "增長動能轉弱" },
  { key: "riskAppetiteScore", label: "風險偏好", up: "風險偏好改善", down: "風險偏好降溫" },
  { key: "dollarScore", label: "美元壓力", up: "美元壓力升高", down: "美元壓力回落" },
  { key: "creditScore", label: "信用環境", up: "信用環境改善", down: "信用條件轉弱" },
  { key: "commodityScore", label: "商品週期", up: "商品週期改善", down: "商品週期轉弱" },
  { key: "chinaScore", label: "中國宏觀", up: "中國宏觀改善", down: "中國宏觀轉弱" },
];

function scoreClass(scoreKey: string, value: number | null): string {
  if (value === null || scoreKey === "china_score") return "border-white/10 bg-white/5 text-slate-400";

  if (scoreKey === "inflation_score") {
    if (value >= 2) return "border-market-amber/30 bg-market-amber/10 text-market-amber";
    if (value < -1) return "border-slate-500/20 bg-slate-500/10 text-slate-300";
    return "border-white/10 bg-white/5 text-slate-400";
  }

  if (scoreKey === "dollar_score") {
    if (value >= 2) return "border-purple-500/30 bg-purple-500/10 text-purple-300";
    if (value < -1) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    return "border-white/10 bg-white/5 text-slate-400";
  }

  if (value !== null && value > 0) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  if (value !== null && value < 0) return "border-red-500/20 bg-red-500/10 text-red-300";
  return "border-white/10 bg-white/5 text-slate-400";
}

function signedScore(value: number | null): string {
  if (value === null) return "暫無數據";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function scoreChangeClass(value: number | null): string {
  if (value === null || value === 0) return "text-slate-500";
  if (value > 0) return "text-emerald-300";
  return "text-red-300";
}

function scoreChangeLabel(value: number | null): string {
  if (value === null) return "無前值";
  if (value === 0) return "Δ 0.0";
  return `Δ ${signedScore(value)}`;
}

function scoreChangeFor(scoreKey: string, changes: ScoreChanges): ScoreChange | null {
  const map: Record<string, keyof ScoreChanges> = {
    liquidity_score: "liquidityScore",
    inflation_score: "inflationScore",
    growth_score: "growthScore",
    risk_appetite_score: "riskAppetiteScore",
    dollar_score: "dollarScore",
    credit_score: "creditScore",
    commodity_score: "commodityScore",
    china_score: "chinaScore",
  };
  const key = map[scoreKey];
  return key ? changes[key] : null;
}

function importantScoreChanges(changes: ScoreChanges) {
  return scoreChangeMeta
    .map((meta) => ({ ...meta, change: changes[meta.key] }))
    .filter((item) => item.change.change !== null && item.change.change !== 0)
    .sort((a, b) => Math.abs(b.change.change ?? 0) - Math.abs(a.change.change ?? 0))
    .slice(0, 3);
}

function changeMeaning(change: number, up: string, down: string): string {
  return change > 0 ? up : down;
}

function isRiskChange(key: ScoreChangeKey, change: number): boolean {
  if (key === "inflationScore" || key === "dollarScore") return change > 0;
  if (key === "liquidityScore" || key === "growthScore" || key === "riskAppetiteScore" || key === "creditScore" || key === "commodityScore") return change < 0;
  return false;
}

function MainConclusion({ regime, fallback }: { regime: string; fallback: string }) {
  if (regime === "避險模式") {
    return (
      <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">
        目前已確認為避險模式。美元壓力明顯升高，信用環境與流動性轉弱，風險偏好分數為負，代表資金更偏向防守。若 VIX、信用利差與美元繼續同步走高，避險狀態將更穩固。
      </p>
    );
  }
  return <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">{compactText(fallback)}</p>;
}

function ImportantScoreChanges({ changes }: { changes: ScoreChanges }) {
  const items = importantScoreChanges(changes);
  if (items.length === 0) return null;
  const hasRiskChange = items.some((item) => isRiskChange(item.key, item.change.change ?? 0));
  const containerClass = hasRiskChange
    ? "border-amber-500/20 bg-amber-950/20 text-amber-100"
    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-100";
  const dotClass = hasRiskChange ? "bg-market-amber" : "bg-market-teal";

  return (
    <div className={`mt-4 rounded-md border px-3 py-2 text-sm leading-6 ${containerClass}`}>
      <div className="font-semibold">今日最重要變化</div>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li key={item.key} className="flex gap-2 text-sm">
            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
            <span>
              {item.label}：{signedScore(item.change.previous)} → {signedScore(item.change.current)}，{changeMeaning(item.change.change ?? 0, item.up, item.down)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScoreMiniCard({ scoreKey, label, value, change, title }: { scoreKey: string; label: string; value: number | null; change: ScoreChange | null; title: string }) {
  return (
    <div title={title} className={`rounded-lg border px-3 py-2 ${scoreClass(scoreKey, value)}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-100">{label}</span>
        <span className="whitespace-nowrap text-sm font-semibold">{signedScore(value)}</span>
      </div>
      <div className={`mt-1 text-xs font-medium ${scoreChangeClass(change?.change ?? null)}`}>{scoreChangeLabel(change?.change ?? null)}</div>
      <div className="dashboard-simple-only mt-0.5 text-[11px] leading-4 text-slate-400">{scoreSubtitle(scoreKey)}</div>
      <div className="dashboard-professional-only mt-0.5 truncate text-[11px] text-slate-500">{scoreKey}</div>
    </div>
  );
}

function scoreSubtitle(scoreKey: string): string {
  const subtitles: Record<string, string> = {
    liquidity_score: "市場資金是否寬鬆",
    inflation_score: "物價和利率壓力",
    growth_score: "經濟增長是否有支撐",
    risk_appetite_score: "市場是否願意冒險",
    dollar_score: "美元是否偏強",
    credit_score: "信用市場是否健康",
    commodity_score: "商品價格是否支持周期",
    china_score: "中國宏觀數據狀態",
  };
  return subtitles[scoreKey] ?? "宏觀分數狀態";
}

function easyRegimeSubtitle(regime: string): string {
  const subtitles: Record<string, string> = {
    混合震盪模式: "市場方向不明，暫時不適合單邊押注。",
    避險模式: "市場偏防守，資金更謹慎，不太願意承擔風險。",
    通脹壓力偏高: "市場主要擔心物價和利率壓力。",
    風險偏好模式: "市場較願意承擔風險，股票和信用資產較容易得到支持。",
    高利率風險偏好環境: "市場願意冒險，但利率和美元壓力仍高。",
    高利率韌性環境: "經濟仍有韌性，但高利率會限制資產估值。",
    再通脹交易: "市場在擔心物價、商品和長期利率重新上升。",
    衰退降息交易: "市場更擔心經濟轉弱，並期待未來降息。",
    "美元/流動性收緊模式": "美元和資金壓力偏高，風險資產容易承壓。",
    "商品/黃金強勢模式": "商品或黃金較強，市場正在交易周期或避險需求。",
  };
  return subtitles[regime] ?? "市場狀態較混合，需要觀察更多信號。";
}

function WatchFocusCard({ items }: { items: string[] }) {
  const focusItems = items.slice(0, 3);
  const easyItems = [
    {
      title: "美元是否繼續走強？",
      description: "如果美元和人民幣匯率壓力一起上升，通常代表市場避險情緒仍在。",
    },
    {
      title: "美債利率是否繼續上升？",
      description: "如果長期利率繼續升，股票和高估值資產可能會受壓。",
    },
    {
      title: "市場恐慌指數是否升高？",
      description: "如果 VIX 和信用利差一起上升，代表市場壓力增加。",
    },
  ];
  return (
    <div className="panel rounded-lg p-4">
      <div className="text-sm font-semibold text-white">Watch Focus / 今日觀察重點</div>
      <ul className="dashboard-simple-only mt-3 space-y-2">
        {easyItems.map((item) => (
          <li key={item.title} className="text-xs leading-5 text-slate-300">
            <div className="flex gap-2 font-medium text-slate-100">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-market-blue" />
              <span>{item.title}</span>
            </div>
            <div className="ml-3.5 mt-0.5 text-slate-500">{item.description}</div>
          </li>
        ))}
      </ul>
      {focusItems.length > 0 ? (
        <ul className="dashboard-professional-only mt-3 space-y-2">
          {focusItems.map((item) => (
            <li key={item} className="flex gap-2 text-xs leading-5 text-slate-300">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-market-blue" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="dashboard-professional-only mt-3 text-xs leading-5 text-slate-500">暫無特別觀察重點。</div>
      )}
    </div>
  );
}

function CompactList({ items, color = "bg-market-teal", max }: { items: string[]; color?: string; max?: number }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {(max ? items.slice(0, max) : items).map((item) => (
        <li key={item} className="flex gap-2 text-sm leading-6 text-slate-300">
          <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${color}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function DashboardPage() {
  const viewModel = await getDashboardViewModel();
  const {
    displayedRegime,
    insights,
    latestAlerts,
    chartSource,
    chartData,
    tableStats,
    dataStatus,
    confirmedRegimeState,
    scoreChanges,
    researchNarrative,
    scoreBreakdowns,
  } = viewModel;
  const rawSignalMatchesConfirmed = confirmedRegimeState.rawRegimeSignal === confirmedRegimeState.confirmedRegime;

  return (
    <div className="space-y-6">
      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
        <div className="panel rounded-lg p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Confirmed Regime / 已確認宏觀狀態</div>
              <h1 className="mt-3 text-4xl font-semibold tracking-normal text-white">{confirmedRegimeState.confirmedRegime}</h1>
              <div className="dashboard-simple-only mt-2 text-sm leading-6 text-slate-300">{easyRegimeSubtitle(confirmedRegimeState.confirmedRegime)}</div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-market-teal/30 bg-market-teal/10 px-2.5 py-1 text-market-teal">Confirmed</span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-slate-300">Confidence: {confirmedRegimeState.confidence}</span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-slate-300">已維持 {confirmedRegimeState.daysInConfirmedRegime} 天</span>
              </div>
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <DashboardModeToggle />
              <Link href="/indicators" className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-slate-300 hover:border-market-teal/50 hover:text-market-teal">
                查看指標
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
          <div className={`mt-5 rounded-md border px-3 py-2 text-sm leading-6 ${
            rawSignalMatchesConfirmed
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
              : "border-amber-500/25 bg-amber-500/10 text-amber-200"
          }`}>
            {rawSignalMatchesConfirmed
              ? "系統狀態：今日信號與已確認狀態一致"
              : `今日信號指向 ${confirmedRegimeState.rawRegimeSignal}，尚未確認為正式 regime`}
          </div>
          <div className="mt-3 text-sm leading-6 text-slate-300">
            {confirmedRegimeState.pendingRegime ? (
              <span>
                潛在切換：{confirmedRegimeState.pendingRegime}，確認進度 {confirmedRegimeState.pendingConfirmationDays} / {confirmedRegimeState.requiredConfirmationDays}
              </span>
            ) : (
              <span className="text-slate-500">暫無新的 regime 切換信號</span>
            )}
          </div>
          <ImportantScoreChanges changes={scoreChanges} />
          <MainConclusion regime={confirmedRegimeState.confirmedRegime} fallback={researchNarrative.conclusion} />
          <PlainLanguageCard
            confirmedRegime={confirmedRegimeState.confirmedRegime}
            rawRegimeSignal={confirmedRegimeState.rawRegimeSignal}
            scoreBreakdowns={scoreBreakdowns}
            watchNext={researchNarrative.watchNext}
          />
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div>
              <h3 className="text-xs font-semibold text-slate-500">為什麼</h3>
              <CompactList items={researchNarrative.why} max={2} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500">與上次相比</h3>
              <CompactList items={researchNarrative.changes} color="bg-slate-500" max={2} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500">下一步觀察</h3>
              <CompactList items={researchNarrative.watchNext} color="bg-market-blue" max={3} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel rounded-lg p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white">數據狀態</div>
              <UpdateDataButton compact />
            </div>
            <div className="mt-3 space-y-1 text-xs leading-5">
              <div className="text-slate-200">最後更新：{dataStatus.lastUpdatedAt ?? "暫無"}</div>
              <div className="text-slate-500">ET：{dataStatus.lastUpdatedAtEastern ?? "暫無"}</div>
              <div className="text-slate-300">
                覆蓋：{dataStatus.activeIndicatorsWithDataCount} / {dataStatus.activeIndicatorCount} active
                <span className="mx-1.5 text-slate-600">|</span>
                總指標：{dataStatus.indicatorCount}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {dataStatus.providers.map((provider) => (
                <ProviderBadge key={provider.name} provider={provider} />
              ))}
            </div>
            <div className="mt-2 space-y-1 text-xs">
              {dataStatus.providers.filter((provider) => shouldShowProviderDetail(provider, dataStatus.lastUpdatedAt)).map((provider) => (
                <div key={provider.name} className={provider.status === "normal" ? "text-slate-500" : "text-red-300"}>
                  {provider.status === "normal"
                    ? `${provider.name} 最近成功：${provider.latestSuccessAt ?? "暫無"}`
                    : `${provider.name} 異常：${provider.errorType ?? statusLabel(provider.status)} - ${shortErrorMessage(provider.errorMessage)}`}
                </div>
              ))}
              {dataStatus.hasAbnormalStatus ? (
                <div className="pt-1 text-yellow-300">
                  {dataStatus.isUsingFallback ? <div>目前顯示的是上次成功生成的宏觀狀態。</div> : null}
                  {dataStatus.isUsingFallback ? <div>上次成功生成時間：{dataStatus.lastSuccessfulRegimeAt ?? "暫無"}</div> : null}
                  {dataStatus.message ? <div>{dataStatus.message}</div> : null}
                </div>
              ) : null}
            </div>
          </div>
          <WatchFocusCard items={researchNarrative.watchNext} />
        </div>
      </section>

      <section className="panel rounded-lg p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {scoreBreakdowns.map((item) => (
            <ScoreMiniCard key={item.key} scoreKey={item.key} label={item.nameZh} value={item.score} change={scoreChangeFor(item.key, scoreChanges)} title={item.description} />
          ))}
        </div>
      </section>

      <section className="panel rounded-lg p-5">
        <h2 className="text-base font-semibold text-white">
          <span className="dashboard-simple-only">分數背後的原因</span>
          <span className="dashboard-professional-only">宏觀評分拆解</span>
        </h2>
        <div className="dashboard-simple-only mt-1 text-xs text-slate-500">點擊任一項，可以查看這個分數由哪些市場數據推動。</div>
        <div className="dashboard-professional-only mt-1 text-xs text-slate-500">點擊任一 score 查看因子拆解、貢獻與數值變化。</div>
        <ScoreBreakdownAccordion scores={scoreBreakdowns} />
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

      <section>
        <h2 className="mb-3 text-base font-semibold text-white">詳細解釋</h2>
        <div className="grid gap-4 xl:grid-cols-3">
          <InsightPanel title="主要支持因素" subtitle="Key Drivers" items={insights.keyDrivers} />
          <InsightPanel title="矛盾信號" subtitle="Conflicting Signals" items={insights.conflictingSignals} />
          <InsightPanel title="下一步觀察" subtitle="Watch Next" items={insights.watchNext} />
        </div>
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
          <div className="overflow-x-auto md:overflow-x-visible">
            <table className="w-full min-w-[560px] table-fixed text-left text-xs sm:text-sm md:min-w-0">
              <thead className="bg-white/[0.03] text-xs text-slate-500">
                <tr>
                  <th className="w-[30%] px-3 py-2.5">指標</th>
                  <th className="w-[18%] px-3 py-2.5">最新</th>
                  <th className="w-[20%] px-3 py-2.5">日期</th>
                  <th className="w-[16%] px-3 py-2.5">30日</th>
                  <th className="w-[16%] px-3 py-2.5">趨勢</th>
                </tr>
              </thead>
              <tbody>
                {tableStats.map((item) =>
                  item ? (
                    <tr key={item.indicator.symbol} className="border-t border-white/10">
                      <td className="truncate px-3 py-2.5 font-medium text-white">{item.indicator.symbol}</td>
                      <td className="truncate px-3 py-2.5 text-slate-300">{formatNumber(item.latestValue)}</td>
                      <td className="truncate px-3 py-2.5 text-slate-500">{formatDate(item.latestDate)}</td>
                      <td className="truncate px-3 py-2.5 text-slate-300">{formatChange(item.change30d)}</td>
                      <td className="truncate px-3 py-2.5 text-slate-300">{trendLabel(item.trend)}</td>
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
