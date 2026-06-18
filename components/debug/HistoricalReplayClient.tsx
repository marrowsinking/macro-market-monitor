"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import type {
  HistoricalReplayResult,
  HistoricalReplayRowStatus,
  HistoricalReplayStability,
} from "@/lib/debug/historicalReplayService";
import { formatDebugNumber } from "@/lib/debug/shadowScoreDebugView";

type Tone = "green" | "teal" | "amber" | "red" | "gray";

const scoreColumns = [
  ["liquidity_score", "Liquidity"],
  ["inflation_score", "Inflation"],
  ["growth_score", "Growth"],
  ["risk_appetite_score", "Risk Appetite"],
  ["dollar_score", "Dollar"],
  ["credit_score", "Credit"],
  ["commodity_score", "Commodity"],
  ["china_score", "China"],
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isReplayPayload(value: unknown): value is HistoricalReplayResult {
  return isRecord(value) && value.engineVersion === "historical-replay-debug" && Array.isArray(value.rows) && isRecord(value.summary);
}

function toneClass(tone: Tone): string {
  if (tone === "green") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  if (tone === "teal") return "border-cyan-500/20 bg-cyan-500/10 text-cyan-300";
  if (tone === "amber") return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  if (tone === "red") return "border-rose-500/20 bg-rose-500/10 text-rose-300";
  return "border-white/10 bg-white/5 text-slate-400";
}

function statusTone(status: HistoricalReplayRowStatus): Tone {
  if (status === "ok") return "green";
  if (status === "partial") return "amber";
  return "red";
}

function stabilityTone(stability: HistoricalReplayStability): Tone {
  if (stability === "stable") return "green";
  if (stability === "watch") return "amber";
  if (stability === "unstable") return "red";
  return "gray";
}

function Badge({ label, tone }: { label: string; tone: Tone }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneClass(tone)}`}>{label}</span>;
}

function MetricCard({ label, value, tone = "gray" }: { label: string; value: number; tone?: Tone }) {
  return (
    <div className={`rounded-lg border p-4 ${toneClass(tone)}`}>
      <div className="text-xs uppercase tracking-wide opacity-75">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export function HistoricalReplayClient() {
  const [payload, setPayload] = useState<HistoricalReplayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState("90");
  const [step, setStep] = useState("1");

  const query = useMemo(() => {
    const search = new URLSearchParams();
    if (days) search.set("days", days);
    if (step) search.set("step", step);
    return search.toString();
  }, [days, step]);

  const loadReplay = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const response = await fetch(`/api/debug/historical-replay?${query}`, { cache: "no-store" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = isRecord(body) && typeof body.message === "string" ? body.message : "Failed to load historical replay";
        throw new Error(message);
      }
      if (!isReplayPayload(body)) {
        throw new Error("Invalid historical replay response.");
      }
      setPayload(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load historical replay");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  useEffect(() => {
    void loadReplay();
  }, [loadReplay]);

  const recentRows = payload ? payload.rows.slice().reverse().slice(0, 100) : [];

  return (
    <main className="space-y-6">
      <section className="rounded-xl border border-white/10 bg-ink-900/70 p-5 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Historical Replay</h1>
            <p className="mt-1 text-sm text-slate-400">Debug-only reconstruction of v2 shadow scores over historical dates.</p>
            <div className="mt-4 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              This page does not affect official dashboard, confirmed regime, alerts, or score calculation.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadReplay()}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-market-teal/40 px-3 py-2 text-sm font-medium text-market-teal transition hover:bg-market-teal/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <label className="text-xs text-slate-400">
            Days
            <select
              value={days}
              onChange={(event) => setDays(event.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-market-teal/50"
            >
              {["90", "180", "365"].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Step
            <select
              value={step}
              onChange={(event) => setStep(event.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-market-teal/50"
            >
              {["1", "5", "10"].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          {payload ? (
            <div className="rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-xs text-slate-500">
              generatedAt: {payload.generatedAt}
              <br />
              range: {payload.params.startDate} to {payload.params.endDate}
            </div>
          ) : null}
        </div>
      </section>

      {loading ? <div className="rounded-xl border border-white/10 bg-ink-900/70 p-5 text-sm text-slate-400">Loading historical replay...</div> : null}

      {error ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-5">
          <h2 className="text-base font-semibold text-rose-200">Failed to load historical replay</h2>
          <p className="mt-2 text-sm text-rose-100">{error}</p>
        </div>
      ) : null}

      {payload ? (
        <>
          <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <MetricCard label="Replay Dates" value={payload.summary.replayDates} />
            <MetricCard label="Successful Dates" value={payload.summary.successfulDates} tone="green" />
            <MetricCard label="Partial Dates" value={payload.summary.partialDates} tone="amber" />
            <MetricCard label="Failed Dates" value={payload.summary.failedDates} tone="red" />
            <MetricCard label="Stable Scores" value={payload.summary.stableScores} tone="green" />
            <MetricCard label="Watch Scores" value={payload.summary.watchScores} tone="amber" />
            <MetricCard label="Unstable Scores" value={payload.summary.unstableScores} tone="red" />
            <MetricCard label="Unavailable Scores" value={payload.summary.unavailableScores} />
          </section>

          <section className="rounded-xl border border-white/10 bg-ink-900/70 p-5">
            <h2 className="text-base font-semibold text-white">Score Summary</h2>
            <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
              <table className="min-w-[1100px] w-full border-collapse text-left text-xs">
                <thead className="bg-white/[0.04] text-slate-400">
                  <tr>
                    {["Score", "Stability", "Available", "Missing", "Average", "Min", "Max", "Latest", "Sign Flips", "Large Moves", "Saturation", "Notes"].map((column) => (
                      <th key={column} className="px-3 py-2 font-medium">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {payload.summary.scoreSummaries.map((summary) => (
                    <tr key={summary.scoreKey} className="text-slate-300">
                      <td className="px-3 py-2">
                        <div className="font-semibold text-white">{summary.label}</div>
                        <div className="font-mono text-[11px] text-slate-500">{summary.scoreKey}</div>
                      </td>
                      <td className="px-3 py-2"><Badge label={summary.stability} tone={stabilityTone(summary.stability)} /></td>
                      <td className="px-3 py-2">{summary.availableCount}</td>
                      <td className="px-3 py-2">{summary.missingCount}</td>
                      <td className="px-3 py-2">{formatDebugNumber(summary.average)}</td>
                      <td className="px-3 py-2">{formatDebugNumber(summary.min)}</td>
                      <td className="px-3 py-2">{formatDebugNumber(summary.max)}</td>
                      <td className="px-3 py-2">{formatDebugNumber(summary.latest)}</td>
                      <td className="px-3 py-2">{summary.signFlipCount}</td>
                      <td className="px-3 py-2">{summary.largeMoveCount}</td>
                      <td className="px-3 py-2">{summary.saturationCount}</td>
                      <td className="max-w-[360px] px-3 py-2 text-slate-500">{summary.notes.join(" ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-ink-900/70 p-5">
            <h2 className="text-base font-semibold text-white">Replay Rows</h2>
            <p className="mt-1 text-xs text-slate-500">Recent rows first. Showing up to 100 rows.</p>
            <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
              <table className="min-w-[1150px] w-full border-collapse text-left text-xs">
                <thead className="bg-white/[0.04] text-slate-400">
                  <tr>
                    {["Date", "Status", ...scoreColumns.map(([, label]) => label), "Notes"].map((column) => (
                      <th key={column} className="px-3 py-2 font-medium">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {recentRows.map((row) => (
                    <tr key={row.date} className="text-slate-300">
                      <td className="px-3 py-2 font-mono text-slate-100">{row.date}</td>
                      <td className="px-3 py-2"><Badge label={row.status} tone={statusTone(row.status)} /></td>
                      {scoreColumns.map(([scoreKey]) => (
                        <td key={scoreKey} className="px-3 py-2">{formatDebugNumber(row.scores[scoreKey])}</td>
                      ))}
                      <td className="max-w-[360px] px-3 py-2 text-slate-500">{row.notes.join(" ") || (row.unavailableScores.length > 0 ? `Unavailable: ${row.unavailableScores.join(", ")}` : "—")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {payload.globalNotes.length > 0 ? (
            <section className="rounded-xl border border-white/10 bg-ink-900/70 p-5">
              <h2 className="text-base font-semibold text-white">Notes</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {payload.globalNotes.map((note) => (
                  <li key={note}>- {note}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
