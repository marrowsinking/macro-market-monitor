"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { MacroScoreKey } from "@/lib/config/macroEngineConfig.types";
import type { DirectionAgreement, MagnitudeBucket, ScoreComparisonPayload } from "@/lib/debug/scoreComparisonDebugService";
import {
  buildShadowScoreDebugQuery,
  formatDebugNumber,
  shadowScoreDebugOrder,
  statusTone,
  type DebugStatusTone,
} from "@/lib/debug/shadowScoreDebugView";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isComparisonPayload(value: unknown): value is ScoreComparisonPayload {
  return isRecord(value) && value.engineVersion === "v1-v2-score-comparison-debug" && isRecord(value.comparison) && isRecord(value.summary);
}

function badgeClass(tone: DebugStatusTone): string {
  if (tone === "green") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  if (tone === "amber") return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  if (tone === "red") return "border-rose-500/20 bg-rose-500/10 text-rose-300";
  return "border-white/10 bg-white/5 text-slate-400";
}

function directionTone(direction: DirectionAgreement): DebugStatusTone {
  if (direction === "same_positive" || direction === "same_negative" || direction === "both_neutral") return "green";
  if (direction === "opposite") return "amber";
  return "gray";
}

function magnitudeTone(bucket: MagnitudeBucket): DebugStatusTone {
  if (bucket === "large") return "amber";
  if (bucket === "medium") return "amber";
  if (bucket === "small") return "green";
  return "gray";
}

function Badge({ label, tone }: { label: string; tone: DebugStatusTone }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeClass(tone)}`}>{label}</span>;
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

export function ScoreComparisonDebugClient() {
  const [payload, setPayload] = useState<ScoreComparisonPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [preferredWindow, setPreferredWindow] = useState("");
  const [zScoreForFullSignal, setZScoreForFullSignal] = useState("2");
  const [summary, setSummary] = useState(false);

  const query = useMemo(
    () => buildShadowScoreDebugQuery({ preferredWindow, zScoreForFullSignal, summary }),
    [preferredWindow, zScoreForFullSignal, summary],
  );

  const loadComparison = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const response = await fetch(`/api/debug/score-comparison${query ? `?${query}` : ""}`, { cache: "no-store" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = isRecord(body) && typeof body.message === "string" ? body.message : "Failed to load score comparison";
        throw new Error(message);
      }
      if (!isComparisonPayload(body)) {
        throw new Error("Invalid score comparison response.");
      }
      setPayload(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load score comparison");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  useEffect(() => {
    void loadComparison();
  }, [loadComparison]);

  const comparisonRows = shadowScoreDebugOrder
    .map((scoreKey) => (payload ? payload.comparison[scoreKey] : null))
    .filter((row): row is ScoreComparisonPayload["comparison"][MacroScoreKey] => Boolean(row));

  return (
    <main className="space-y-6">
      <section className="rounded-xl border border-white/10 bg-ink-900/70 p-5 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">V1 vs V2 Score Comparison</h1>
            <p className="mt-1 text-sm text-slate-400">Compare official current macro scores with v2 shadow scores. Debug only.</p>
            <div className="mt-4 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              This page does not affect the official dashboard, regime calculation, or alerts.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadComparison()}
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
            summary query
          </label>
        </div>
      </section>

      {loading ? <div className="rounded-xl border border-white/10 bg-ink-900/70 p-5 text-sm text-slate-400">Loading score comparison...</div> : null}

      {error ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-5">
          <h2 className="text-base font-semibold text-rose-200">Failed to load score comparison</h2>
          <p className="mt-2 text-sm text-rose-100">{error}</p>
        </div>
      ) : null}

      {payload ? (
        <>
          <section className="rounded-xl border border-white/10 bg-ink-900/70 p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Debug Source</h2>
                <p className="mt-1 text-xs text-slate-500">
                  generatedAt: {payload.generatedAt} · engineVersion: {payload.engineVersion}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge label={`v1 ${payload.v1.status}`} tone={payload.v1.status === "ok" ? "green" : payload.v1.status === "partial" ? "amber" : "gray"} />
                <Badge label={`v2 ${payload.v2.status}`} tone={statusTone(payload.v2.status)} />
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-300">
                  v1 source: {payload.v1.source}
                </span>
              </div>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            <MetricCard label="Comparable Scores" value={payload.summary.comparableScoreCount} />
            <MetricCard label="Opposite Direction" value={payload.summary.oppositeDirectionCount} />
            <MetricCard label="Large Difference" value={payload.summary.largeDifferenceCount} />
            <MetricCard label="Avg Abs Difference" value={formatDebugNumber(payload.summary.averageAbsDifference, { signed: false })} />
          </section>

          <section className="rounded-xl border border-white/10 bg-ink-900/70 p-5">
            <h2 className="text-base font-semibold text-white">Comparison Table</h2>
            <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
              <table className="min-w-[900px] w-full border-collapse text-left text-xs">
                <thead className="bg-white/[0.04] text-slate-400">
                  <tr>
                    {["Score", "V1", "V2", "Difference", "Direction", "Magnitude", "Status"].map((column) => (
                      <th key={column} className="px-3 py-2 font-medium">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {comparisonRows.map((row) => (
                    <tr key={row.scoreKey} className="text-slate-300">
                      <td className="px-3 py-2">
                        <div className="font-semibold text-white">{row.zhName}</div>
                        <div className="font-mono text-[11px] text-slate-500">{row.scoreKey}</div>
                      </td>
                      <td className="px-3 py-2">{formatDebugNumber(row.v1Value)}</td>
                      <td className="px-3 py-2">{formatDebugNumber(row.v2Value)}</td>
                      <td className="px-3 py-2 font-semibold">{formatDebugNumber(row.difference)}</td>
                      <td className="px-3 py-2">
                        <Badge label={row.directionAgreement} tone={directionTone(row.directionAgreement)} />
                      </td>
                      <td className="px-3 py-2">
                        <Badge label={row.magnitudeBucket} tone={magnitudeTone(row.magnitudeBucket)} />
                      </td>
                      <td className="px-3 py-2">
                        <Badge label={row.status} tone={statusTone(row.status)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-ink-900/70 p-5">
            <h2 className="text-base font-semibold text-white">Largest Differences</h2>
            {payload.summary.largestDifferences.length > 0 ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {payload.summary.largestDifferences.slice(0, 5).map((item) => (
                  <div key={item.scoreKey} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="text-sm font-semibold text-white">{item.zhName}</div>
                    <div className="mt-1 font-mono text-xs text-slate-500">{item.scoreKey}</div>
                    <div className="mt-3 text-xs text-slate-400">
                      V1 {formatDebugNumber(item.v1Value)} · V2 {formatDebugNumber(item.v2Value)}
                    </div>
                    <div className="mt-2 text-xl font-semibold text-amber-200">{formatDebugNumber(item.absDifference, { signed: false })}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">No comparable differences.</p>
            )}
          </section>

          {payload.warnings.length > 0 ? (
            <section className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-5">
              <h2 className="text-base font-semibold text-amber-100">Warnings</h2>
              <div className="mt-3 space-y-2">
                {payload.warnings.map((warning) => (
                  <div key={warning} className="rounded-md border border-amber-500/20 bg-ink-950/30 px-3 py-2 text-sm text-amber-100">
                    {warning}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
