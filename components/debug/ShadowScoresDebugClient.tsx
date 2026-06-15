"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import type { MacroScoreKey } from "@/lib/config/macroEngineConfig.types";
import type { ShadowScoreDebugPayload, ShadowScoreDebugSummary } from "@/lib/engines/shadowScoreDebugService";
import {
  buildShadowScoreDebugQuery,
  formatDebugNumber,
  shadowScoreDebugOrder,
  statusTone,
  type DebugStatusTone,
} from "@/lib/debug/shadowScoreDebugView";

type DebugPayload = ShadowScoreDebugPayload | ShadowScoreDebugSummary;
type DebugScore = DebugPayload["scores"][MacroScoreKey];
type FullScore = ShadowScoreDebugPayload["scores"][MacroScoreKey];
type FullGroup = FullScore["groups"][number];
type SummaryGroup = ShadowScoreDebugSummary["scores"][MacroScoreKey]["groups"][number];
type DebugGroup = FullGroup | SummaryGroup;
type DebugFactor = FullGroup["factors"][number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDebugPayload(value: unknown): value is DebugPayload {
  return isRecord(value) && typeof value.generatedAt === "string" && isRecord(value.coverage) && isRecord(value.scores);
}

function groupHasFactors(group: DebugGroup): group is FullGroup {
  return "factors" in group && Array.isArray(group.factors);
}

function scoreHasFullGroups(score: DebugScore): score is FullScore {
  return score.groups.some(groupHasFactors);
}

function badgeClass(tone: DebugStatusTone): string {
  if (tone === "green") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  if (tone === "amber") return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  if (tone === "red") return "border-rose-500/20 bg-rose-500/10 text-rose-300";
  return "border-white/10 bg-white/5 text-slate-400";
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeClass(statusTone(status))}`}>{status}</span>;
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function scoreCardTone(value: number, status: string): string {
  if (status === "not_scored") return "border-white/10 bg-white/[0.03]";
  if (status === "no_data") return "border-rose-500/20 bg-rose-500/5";
  if (status === "partial") return "border-amber-500/20 bg-amber-500/5";
  if (value > 0) return "border-emerald-500/20 bg-emerald-500/5";
  if (value < 0) return "border-rose-500/20 bg-rose-500/5";
  return "border-white/10 bg-white/[0.03]";
}

function FactorTable({ factors }: { factors: DebugFactor[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-white/10">
      <table className="min-w-[1100px] w-full border-collapse text-left text-xs">
        <thead className="bg-white/[0.04] text-slate-400">
          <tr>
            {["Symbol", "Name", "Weight", "Polarity", "Normalized Signal", "Z-score", "Percentile", "Raw Value", "Contribution", "Status", "Message"].map((column) => (
              <th key={column} className="px-3 py-2 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {factors.map((factor) => (
            <tr key={`${factor.scoreKey}-${factor.groupKey}-${factor.symbol}`} className="text-slate-300">
              <td className="px-3 py-2 font-mono text-slate-100">{factor.symbol}</td>
              <td className="px-3 py-2">{factor.name}</td>
              <td className="px-3 py-2">{formatDebugNumber(factor.weight, { signed: false })}</td>
              <td className="px-3 py-2">{factor.scorePolarity}</td>
              <td className="px-3 py-2">{formatDebugNumber(factor.normalizedSignal)}</td>
              <td className="px-3 py-2">{formatDebugNumber(factor.zScore)}</td>
              <td className="px-3 py-2">{formatDebugNumber(factor.percentile, { signed: false })}</td>
              <td className="px-3 py-2">{formatDebugNumber(factor.rawValue, { signed: false })}</td>
              <td className="px-3 py-2 font-semibold">{formatDebugNumber(factor.contribution)}</td>
              <td className="px-3 py-2">
                <StatusBadge status={factor.status} />
              </td>
              <td className="max-w-[280px] px-3 py-2 text-slate-500">{factor.message ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScoreDetails({ score }: { score: DebugScore }) {
  return (
    <div className="space-y-3 border-t border-white/10 bg-white/[0.025] p-4">
      {score.groups.map((group) => (
        <div key={group.groupKey} className="rounded-lg border border-white/10 bg-ink-950/60 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-market-teal">{group.groupKey}</span>
                {"capApplied" in group && group.capApplied ? (
                  <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">CAP APPLIED</span>
                ) : null}
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                {group.zhName} <span className="font-normal text-slate-500">/ {group.enName}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <Field label="Raw" value={formatDebugNumber(group.rawContribution)} />
              <Field label="Contribution" value={formatDebugNumber(group.contribution)} />
              {"minContribution" in group ? <Field label="Min" value={formatDebugNumber(group.minContribution)} /> : null}
              {"maxContribution" in group ? <Field label="Max" value={formatDebugNumber(group.maxContribution)} /> : null}
            </div>
          </div>
          {groupHasFactors(group) ? (
            <div className="mt-4">
              <FactorTable factors={group.factors} />
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
              Summary mode hides factor details. Turn off summary to inspect factor rows.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ShadowScoresDebugClient() {
  const [payload, setPayload] = useState<DebugPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [preferredWindow, setPreferredWindow] = useState("");
  const [zScoreForFullSignal, setZScoreForFullSignal] = useState("2");
  const [summary, setSummary] = useState(false);
  const [expandedScores, setExpandedScores] = useState<MacroScoreKey[]>([]);

  const query = useMemo(
    () => buildShadowScoreDebugQuery({ preferredWindow, zScoreForFullSignal, summary }),
    [preferredWindow, zScoreForFullSignal, summary],
  );

  const loadScores = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const response = await fetch(`/api/debug/shadow-scores${query ? `?${query}` : ""}`, { cache: "no-store" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = isRecord(body) && typeof body.message === "string" ? body.message : "Failed to load shadow scores";
        throw new Error(message);
      }
      if (!isDebugPayload(body)) {
        throw new Error("Invalid shadow score response.");
      }
      setPayload(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shadow scores");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  useEffect(() => {
    void loadScores();
  }, [loadScores]);

  const toggleScore = (scoreKey: MacroScoreKey) => {
    setExpandedScores((current) => (current.includes(scoreKey) ? current.filter((key) => key !== scoreKey) : [...current, scoreKey]));
  };

  const visibleScores = shadowScoreDebugOrder
    .map((scoreKey) => (payload ? payload.scores[scoreKey] : null))
    .filter((score): score is DebugScore => Boolean(score));

  return (
    <main className="space-y-6">
      <section className="rounded-xl border border-white/10 bg-ink-900/70 p-5 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Shadow Score Debug</h1>
            <p className="mt-1 text-sm text-slate-400">v2 macro score engine preview — not used by official regime calculation</p>
            <div className="mt-4 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm leading-6 text-amber-100">
              This page is for debugging only. Shadow scores are not used by the official dashboard, confirmed regime, or alerts yet.
              <br />
              此頁只供調試與研究使用，目前不會影響正式 Dashboard、Regime 或 Alerts。
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadScores()}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-market-teal/40 px-3 py-2 text-sm font-medium text-market-teal transition hover:bg-market-teal/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <label className="text-xs text-slate-400">
            preferredWindow
            <input
              value={preferredWindow}
              onChange={(event) => setPreferredWindow(event.target.value)}
              placeholder="30 / 60 / 120 / 252 / 365 / 730 / 1095"
              className="mt-1 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-market-teal/50"
            />
          </label>
          <label className="text-xs text-slate-400">
            zScoreForFullSignal
            <input
              value={zScoreForFullSignal}
              onChange={(event) => setZScoreForFullSignal(event.target.value)}
              placeholder="2"
              className="mt-1 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-market-teal/50"
            />
          </label>
          <label className="flex items-end gap-2 rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={summary}
              onChange={(event) => setSummary(event.target.checked)}
              className="mb-1 h-4 w-4 accent-market-teal"
            />
            summary mode
          </label>
        </div>
      </section>

      {loading ? (
        <div className="rounded-xl border border-white/10 bg-ink-900/70 p-5 text-sm text-slate-400">Loading shadow scores...</div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-5">
          <h2 className="text-base font-semibold text-rose-200">Failed to load shadow scores</h2>
          <p className="mt-2 text-sm text-rose-100">{error}</p>
        </div>
      ) : null}

      {payload ? (
        <>
          <section className="rounded-xl border border-white/10 bg-ink-900/70 p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Coverage Summary</h2>
                <p className="mt-1 text-xs text-slate-500">
                  generatedAt: {payload.generatedAt} · engineVersion: {payload.engineVersion}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={payload.coverage.missingSymbolCount > 0 ? "partial" : "ok"} />
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-300">
                  options: window {payload.options.preferredWindow ?? "default"} · z {payload.options.zScoreForFullSignal}
                </span>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Field label="Requested Symbols" value={payload.coverage.requestedSymbolCount} />
              <Field label="Available Symbols" value={payload.coverage.availableSymbolCount} />
              <Field label="Missing Symbols" value={payload.coverage.missingSymbolCount} />
            </div>
            {payload.coverage.missingSymbolCount > 0 ? (
              <div className="mt-4 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                <div className="font-medium">Missing symbols</div>
                <div className="mt-1 font-mono text-xs leading-5">{payload.coverage.missingSymbols.join(", ")}</div>
              </div>
            ) : null}
            {payload.warnings.length > 0 ? (
              <div className="mt-4 space-y-1">
                {payload.warnings.map((warning) => (
                  <div key={warning} className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                    {warning}
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {visibleScores.map((score) => (
              <button
                key={score.scoreKey}
                type="button"
                onClick={() => toggleScore(score.scoreKey)}
                className={`rounded-xl border p-4 text-left transition hover:border-market-teal/40 ${scoreCardTone(score.value, score.status)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{score.zhName}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{score.enName}</div>
                  </div>
                  <StatusBadge status={score.status} />
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-2xl font-semibold text-white">{formatDebugNumber(score.value)}</div>
                    <div className="mt-1 text-xs text-slate-500">raw {formatDebugNumber(score.rawValue)}</div>
                  </div>
                  <div className="font-mono text-[11px] text-slate-500">{score.scoreKey}</div>
                </div>
              </button>
            ))}
          </section>

          <section className="rounded-xl border border-white/10 bg-ink-900/70 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Score Details</h2>
                <p className="mt-1 text-xs text-slate-500">Score sections are collapsed by default. Expand a score to inspect group and factor diagnostics.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setExpandedScores(shadowScoreDebugOrder)} className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/5">
                  Expand all
                </button>
                <button type="button" onClick={() => setExpandedScores([])} className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/5">
                  Collapse all
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {visibleScores.length === 0 ? (
                <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-400">Empty scores response.</div>
              ) : null}
              {visibleScores.map((score) => {
                const expanded = expandedScores.includes(score.scoreKey);
                const Icon = expanded ? ChevronDown : ChevronRight;
                return (
                  <div key={score.scoreKey} className={`overflow-hidden rounded-lg border ${expanded ? "border-market-teal/30" : "border-white/10"}`}>
                    <button
                      type="button"
                      onClick={() => toggleScore(score.scoreKey)}
                      className="flex w-full items-center justify-between gap-4 bg-ink-950/80 px-4 py-3 text-left transition hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={17} className="text-market-teal" />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-white">{score.zhName}</span>
                            <span className="font-mono text-xs text-slate-500">{score.scoreKey}</span>
                            <StatusBadge status={score.status} />
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            value {formatDebugNumber(score.value)} · raw {formatDebugNumber(score.rawValue)} · groups {score.groups.length}
                            {scoreHasFullGroups(score) ? "" : " · summary mode"}
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-slate-500">{expanded ? "Collapse" : "Expand"}</span>
                    </button>
                    {expanded ? <ScoreDetails score={score} /> : null}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
