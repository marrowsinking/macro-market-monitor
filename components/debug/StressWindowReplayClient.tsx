"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  STRESS_WINDOWS,
  type StressWindowInterpretation,
  type StressWindowReplayResult,
  type StressWindowStatus,
  type StressWindowVerdict,
} from "@/lib/debug/stressWindowReplayService";
import { formatDebugNumber } from "@/lib/debug/shadowScoreDebugView";

type Tone = "green" | "teal" | "amber" | "red" | "gray";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStressPayload(value: unknown): value is StressWindowReplayResult {
  return isRecord(value) && value.engineVersion === "stress-window-replay-debug" && Array.isArray(value.windows) && isRecord(value.summary);
}

function toneClass(tone: Tone): string {
  if (tone === "green") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  if (tone === "teal") return "border-cyan-500/20 bg-cyan-500/10 text-cyan-300";
  if (tone === "amber") return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  if (tone === "red") return "border-rose-500/20 bg-rose-500/10 text-rose-300";
  return "border-white/10 bg-white/5 text-slate-400";
}

function verdictTone(verdict: StressWindowVerdict): Tone {
  if (verdict === "pass_like") return "green";
  if (verdict === "watch") return "amber";
  if (verdict === "concern") return "red";
  return "gray";
}

function statusTone(status: StressWindowStatus): Tone {
  if (status === "ok") return "green";
  if (status === "partial") return "amber";
  return "red";
}

function interpretationTone(interpretation: StressWindowInterpretation): Tone {
  if (interpretation === "supportive") return "green";
  if (interpretation === "warning" || interpretation === "conflicting") return "amber";
  if (interpretation === "unavailable") return "gray";
  return "teal";
}

function stabilityTone(stability: string): Tone {
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

function ScoreList({ label, scores, tone }: { label: string; scores: string[]; tone: Tone }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {scores.length > 0 ? scores.map((score) => <Badge key={score} label={score} tone={tone} />) : <span className="text-xs text-slate-600">—</span>}
      </div>
    </div>
  );
}

export function StressWindowReplayClient() {
  const [payload, setPayload] = useState<StressWindowReplayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [windowId, setWindowId] = useState("all");
  const [step, setStep] = useState("5");

  const query = useMemo(() => {
    const search = new URLSearchParams();
    search.set("window", windowId);
    search.set("step", step);
    return search.toString();
  }, [windowId, step]);

  const loadReplay = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const response = await fetch(`/api/debug/stress-window-replay?${query}`, { cache: "no-store" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = isRecord(body) && typeof body.message === "string" ? body.message : "Failed to load stress window replay";
        throw new Error(message);
      }
      if (!isStressPayload(body)) {
        throw new Error("Invalid stress window replay response.");
      }
      setPayload(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stress window replay");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  useEffect(() => {
    void loadReplay();
  }, [loadReplay]);

  const unavailableCount = payload ? payload.windows.filter((window) => window.verdict === "unavailable").length : 0;

  return (
    <main className="space-y-6">
      <section className="rounded-xl border border-white/10 bg-ink-900/70 p-5 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Stress Window Replay</h1>
            <p className="mt-1 text-sm text-slate-400">Debug-only stress-window replay for v2 shadow scores.</p>
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
            Window
            <select
              value={windowId}
              onChange={(event) => setWindowId(event.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-market-teal/50"
            >
              <option value="all">All</option>
              {STRESS_WINDOWS.map((window) => (
                <option key={window.id} value={window.id}>
                  {window.label}
                </option>
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
              engine: {payload.engineVersion}
            </div>
          ) : null}
        </div>
      </section>

      {loading ? <div className="rounded-xl border border-white/10 bg-ink-900/70 p-5 text-sm text-slate-400">Loading stress window replay...</div> : null}

      {error ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-5">
          <h2 className="text-base font-semibold text-rose-200">Failed to load stress window replay</h2>
          <p className="mt-2 text-sm text-rose-100">{error}</p>
        </div>
      ) : null}

      {payload ? (
        <>
          <section className="grid gap-3 md:grid-cols-5">
            <MetricCard label="Total Windows" value={payload.summary.totalWindows} />
            <MetricCard label="Pass-like" value={payload.summary.passLikeCount} tone="green" />
            <MetricCard label="Watch" value={payload.summary.watchCount} tone="amber" />
            <MetricCard label="Concern" value={payload.summary.concernCount} tone="red" />
            <MetricCard label="Unavailable" value={unavailableCount} />
          </section>

          {payload.globalNotes.length > 0 ? (
            <section className="rounded-xl border border-white/10 bg-ink-900/70 p-5">
              <h2 className="text-base font-semibold text-white">Global Notes</h2>
              <ul className="mt-3 space-y-1 text-sm text-slate-400">
                {payload.globalNotes.map((note) => (
                  <li key={note}>- {note}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {payload.windows.map((window) => (
            <section key={window.id} className="rounded-xl border border-white/10 bg-ink-900/70 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-white">{window.label}</h2>
                    <Badge label={window.verdict} tone={verdictTone(window.verdict)} />
                    <Badge label={window.status} tone={statusTone(window.status)} />
                  </div>
                  <p className="mt-1 text-xs font-mono text-slate-500">{window.startDate} to {window.endDate}</p>
                  <p className="mt-2 max-w-4xl text-sm text-slate-400">{window.description}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-xs text-slate-400">
                  replay {window.replaySummary.replayDates} / ok {window.replaySummary.successfulDates} / partial {window.replaySummary.partialDates} / failed {window.replaySummary.failedDates}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-xs uppercase tracking-wide text-slate-500">Focus scores</span>
                {window.expectedFocus.map((scoreKey) => (
                  <Badge key={scoreKey} label={scoreKey} tone="teal" />
                ))}
              </div>

              {window.notes.length > 0 ? (
                <ul className="mt-3 space-y-1 text-xs text-slate-500">
                  {window.notes.map((note) => (
                    <li key={note}>- {note}</li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-4 rounded-lg border border-white/10 bg-ink-950/60 p-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Partial Reason Summary</h3>
                    <p className="mt-1 text-sm text-slate-400">{window.partialReasons.summary}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {window.partialReasons.affectsPromotionReadiness
                        ? "This partial status should be reviewed before using this score group for promotion."
                        : "This partial status is not treated as a direct blocker for the selected focus scores."}
                    </p>
                  </div>
                  <Badge
                    label={`Affects Promotion Readiness: ${window.partialReasons.affectsPromotionReadiness ? "Yes" : "No"}`}
                    tone={window.partialReasons.affectsPromotionReadiness ? "red" : "green"}
                  />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <ScoreList label="Focus Unavailable" scores={window.partialReasons.focusUnavailableScores} tone="red" />
                  <ScoreList label="Non-focus Unavailable" scores={window.partialReasons.nonFocusUnavailableScores} tone="amber" />
                  <ScoreList label="Focus Unstable" scores={window.partialReasons.focusUnstableScores} tone="red" />
                  <ScoreList label="Non-focus Unstable" scores={window.partialReasons.nonFocusUnstableScores} tone="amber" />
                  <ScoreList label="Expected Unavailable" scores={window.partialReasons.expectedUnavailableScores} tone="gray" />
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>missing scores: {window.partialReasons.missingScoreCount}</span>
                  <span>focus missing: {window.partialReasons.focusMissingCount}</span>
                  <span>non-focus missing: {window.partialReasons.nonFocusMissingCount}</span>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
                <table className="min-w-[1180px] w-full border-collapse text-left text-xs">
                  <thead className="bg-white/[0.04] text-slate-400">
                    <tr>
                      {["Score", "Focus", "Interpretation", "Stability", "Average", "Min", "Max", "Latest", "Available", "Missing", "Sign Flips", "Large Moves", "Saturation", "Notes"].map((column) => (
                        <th key={column} className="px-3 py-2 font-medium">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {window.scoreSummaries.map((summary) => (
                      <tr key={summary.scoreKey} className={`text-slate-300 ${summary.focus ? "bg-cyan-500/[0.04]" : ""}`}>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-white">{summary.label}</div>
                          <div className="font-mono text-[11px] text-slate-500">{summary.scoreKey}</div>
                        </td>
                        <td className="px-3 py-2">{summary.focus ? <Badge label="focus" tone="teal" /> : <span className="text-slate-500">—</span>}</td>
                        <td className="px-3 py-2"><Badge label={summary.interpretation} tone={interpretationTone(summary.interpretation)} /></td>
                        <td className="px-3 py-2"><Badge label={summary.stability} tone={stabilityTone(summary.stability)} /></td>
                        <td className="px-3 py-2">{formatDebugNumber(summary.average)}</td>
                        <td className="px-3 py-2">{formatDebugNumber(summary.min)}</td>
                        <td className="px-3 py-2">{formatDebugNumber(summary.max)}</td>
                        <td className="px-3 py-2">{formatDebugNumber(summary.latest)}</td>
                        <td className="px-3 py-2">{summary.availableCount}</td>
                        <td className="px-3 py-2">{summary.missingCount}</td>
                        <td className="px-3 py-2">{summary.signFlipCount}</td>
                        <td className="px-3 py-2">{summary.largeMoveCount}</td>
                        <td className="px-3 py-2">{summary.saturationCount}</td>
                        <td className="max-w-[320px] px-3 py-2 text-slate-500">{summary.notes.join(" ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </>
      ) : null}
    </main>
  );
}
