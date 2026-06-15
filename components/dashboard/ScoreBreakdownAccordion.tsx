"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { ScoreBreakdown, ScoreFactor } from "@/lib/scores/scoreBreakdown";

function scoreTitleClass(value: number | null): string {
  if (value !== null && value > 0) return "text-market-teal";
  if (value !== null && value < 0) return "text-red-300";
  return "text-slate-400";
}

function signedScore(value: number | null): string {
  if (value === null) return "暫無數據";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function contributionClass(value: number | null): string {
  if (value === null) return "text-slate-500";
  if (value > 0) return "text-emerald-300";
  if (value < 0) return "text-red-300";
  return "text-slate-400";
}

function formatSigned(value: number | null, digits = 2): string {
  if (value === null || Number.isNaN(value)) return "暫無";
  return `${value > 0 ? "+" : ""}${formatNumber(value, digits)}`;
}

function factorDisplayName(factor: ScoreFactor): string {
  const names: Record<string, string> = {
    BAMLH0A0HYM2: "信用利差",
    DGS10: "10Y 美債",
    DGS2: "2Y 美債",
    "^GSPC": "S&P 500",
    "^NDX": "Nasdaq",
    "DX-Y.NYB": "DXY",
    "GC=F": "黃金",
    "SI=F": "白銀",
    "HG=F": "銅",
    DCOILWTICO: "原油",
    VIXCLS: "VIX",
  };
  return names[factor.symbol] ?? factor.name;
}

function groupedFactors(factors: ScoreFactor[]) {
  return {
    positive: factors.filter((factor) => factor.contribution !== null && factor.contribution > 0),
    negative: factors.filter((factor) => factor.contribution !== null && factor.contribution < 0),
    neutral: factors.filter((factor) => factor.contribution === null || factor.contribution === 0),
  };
}

function factorList(factors: ScoreFactor[]): string {
  return factors.length > 0 ? factors.map(factorDisplayName).join("、") : "無";
}

function scoreConclusion(score: ScoreBreakdown): string {
  if (score.key === "china_score") return "中國宏觀數據尚未接入，暫不參與 regime 判斷。";

  const groups = groupedFactors(score.factors);
  const positive = factorList(groups.positive);
  const negative = factorList(groups.negative);

  if (score.score === null) return `${score.nameZh}資料不足，暫時不能形成有效判斷。`;
  if (score.score > 0) {
    const strength = score.score >= 3 ? "很強" : "偏強";
    return `${score.nameZh}${strength}，主要由 ${positive} 支持${groups.negative.length > 0 ? `，但 ${negative} 形成拖累` : ""}。`;
  }
  if (score.score < 0) {
    const weakness = score.score <= -3 ? "很弱" : "偏弱";
    return `${score.nameZh}${weakness}，主要受 ${negative} 拖累${groups.positive.length > 0 ? `，但 ${positive} 提供部分支撐` : ""}。`;
  }
  return `${score.nameZh}目前偏中性，正負因子沒有形成明顯方向。`;
}

function FactorSummary({ factors }: { factors: ScoreFactor[] }) {
  const groups = groupedFactors(factors);
  return (
    <div className="grid gap-2 rounded-md border border-white/10 bg-ink-950/40 px-3 py-2 text-xs leading-6 md:grid-cols-3">
      <div><span className="text-slate-500">正貢獻：</span><span className="text-emerald-300">{factorList(groups.positive)}</span></div>
      <div><span className="text-slate-500">負貢獻：</span><span className="text-red-300">{factorList(groups.negative)}</span></div>
      <div><span className="text-slate-500">中性：</span><span className="text-slate-300">{factorList(groups.neutral)}</span></div>
    </div>
  );
}

function FactorRow({ factor }: { factor: ScoreFactor }) {
  return (
    <tr className="border-t border-white/10">
      <td className="px-3 py-2">
        <div className="font-medium text-slate-200">{factor.symbol}</div>
        <div className="text-[11px] text-slate-500">{factor.name}</div>
      </td>
      <td className="px-3 py-2 text-slate-300">{formatNumber(factor.latestValue)}</td>
      <td className="px-3 py-2 text-slate-300">{formatSigned(factor.change3d)}</td>
      <td className="px-3 py-2 text-slate-300">{formatSigned(factor.change30d)}</td>
      <td className={`px-3 py-2 font-semibold ${contributionClass(factor.contribution)}`}>{formatSigned(factor.contribution, 1)}</td>
      <td className="px-3 py-2 text-slate-300">{factor.interpretation}</td>
    </tr>
  );
}

export function ScoreBreakdownAccordion({ scores }: { scores: ScoreBreakdown[] }) {
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  function toggle(key: string) {
    setOpenKeys((current) => {
      if (current.includes(key)) return current.filter((item) => item !== key);
      return [...current, key];
    });
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex justify-end gap-3 text-xs">
        <button type="button" onClick={() => setOpenKeys(scores.map((score) => score.key))} className="text-market-teal hover:text-market-teal/80">
          全部展開
        </button>
        <button type="button" onClick={() => setOpenKeys([])} className="text-slate-400 hover:text-slate-200">
          全部收起
        </button>
      </div>
      {scores.map((score) => {
        const isOpen = openKeys.includes(score.key);
        return (
          <section
            key={score.key}
            className={`overflow-hidden rounded-lg border transition ${
              isOpen ? "border-market-teal/30 bg-market-teal/[0.035]" : "border-white/10 bg-white/[0.015]"
            }`}
          >
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggle(score.key)}
              className="flex w-full cursor-pointer items-start gap-3 bg-ink-950/70 px-4 py-3 text-left transition hover:bg-white/[0.045]"
            >
              <ChevronRight size={17} className={`mt-0.5 shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-90 text-market-teal" : ""}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className={`text-sm font-semibold ${scoreTitleClass(score.score)}`}>{score.nameZh} {signedScore(score.score)}</span>
                  <span className="text-[11px] text-slate-500">{score.key}</span>
                </div>
                <div className="mt-1 max-w-4xl truncate text-xs leading-5 text-slate-400">一句話結論：{scoreConclusion(score)}</div>
              </div>
              <span className="mt-0.5 shrink-0 text-xs text-slate-500">{isOpen ? "點擊收起" : "點擊展開"}</span>
            </button>

            {isOpen ? (
              <div className="border-t border-white/10 bg-white/[0.035] px-4 py-4">
                {score.factors.length > 0 ? (
                  <div>
                    <FactorSummary factors={score.factors} />
                    <div className="mt-4 text-xs font-semibold text-slate-500">詳細因子拆解</div>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full min-w-[860px] text-left text-xs">
                        <thead className="text-slate-500">
                          <tr>
                            <th className="px-3 py-2">因子</th>
                            <th className="px-3 py-2">最新</th>
                            <th className="px-3 py-2">3日</th>
                            <th className="px-3 py-2">30日</th>
                            <th className="px-3 py-2">貢獻</th>
                            <th className="px-3 py-2">解讀</th>
                          </tr>
                        </thead>
                        <tbody>
                          {score.factors.map((factor) => (
                            <FactorRow key={`${score.key}-${factor.symbol}`} factor={factor} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-white/10 bg-ink-950/40 px-3 py-2 text-xs leading-6 text-slate-400">
                    {scoreConclusion(score)}
                  </div>
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
