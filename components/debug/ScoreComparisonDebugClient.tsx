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
  if (direction === "true_opposite") return "red";
  if (
    direction === "v1_positive_v2_neutral" ||
    direction === "v1_negative_v2_neutral" ||
    direction === "v1_neutral_v2_positive" ||
    direction === "v1_neutral_v2_negative"
  ) return "amber";
  return "gray";
}

function directionLabel(direction: DirectionAgreement): string {
  const labels: Record<DirectionAgreement, string> = {
    same_positive: "same positive",
    same_negative: "same negative",
    both_neutral: "both neutral",
    true_opposite: "true opposite",
    v1_positive_v2_neutral: "v1+ / v2 neutral",
    v1_negative_v2_neutral: "v1- / v2 neutral",
    v1_neutral_v2_positive: "v1 neutral / v2+",
    v1_neutral_v2_negative: "v1 neutral / v2-",
    unavailable: "unavailable",
  };
  return labels[direction];
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

          <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Comparable Scores" value={payload.summary.comparableScoreCount} />
            <MetricCard label="Same Direction" value={payload.summary.sameDirectionCount} />
            <MetricCard label="Neutral Divergence" value={payload.summary.neutralDivergenceCount} />
            <MetricCard label="True Opposite" value={payload.summary.trueOppositeDirectionCount} />
            <MetricCard label="Both Neutral" value={payload.summary.bothNeutralCount} />
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
                        <Badge label={directionLabel(row.directionAgreement)} tone={directionTone(row.directionAgreement)} />
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

          <section className="rounded-xl border border-white/10 bg-ink-900/70 p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">V2 Missing / Unavailable Diagnostics</h2>
                <p className="mt-1 text-xs text-slate-500">Factor-level reasons from ShadowScoreResult. Useful for commodity_score and other missing_v2 cases.</p>
              </div>
              <Badge label={`global missing ${payload.v2Diagnostics.missingSymbols.length}`} tone={payload.v2Diagnostics.missingSymbols.length > 0 ? "amber" : "green"} />
            </div>

            {payload.v2Diagnostics.missingSymbols.length > 0 ? (
              <div className="mt-4 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                <div className="text-xs font-semibold text-amber-100">Global missing symbols</div>
                <div className="mt-1 font-mono text-xs leading-5 text-amber-100">{payload.v2Diagnostics.missingSymbols.join(", ")}</div>
              </div>
            ) : null}

            {payload.v2Diagnostics.scoresWithNoData.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">No missing or non-ok v2 factor diagnostics.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {payload.v2Diagnostics.scoresWithNoData.map((score) => (
                  <div key={score.scoreKey} className="rounded-lg border border-white/10 bg-ink-950/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{score.zhName}</div>
                        <div className="font-mono text-xs text-slate-500">{score.scoreKey}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge label={`missing ${score.missingSymbols.length}`} tone={score.missingSymbols.length > 0 ? "amber" : "gray"} />
                        <Badge label={`insufficient ${score.insufficientDataSymbols.length}`} tone={score.insufficientDataSymbols.length > 0 ? "amber" : "gray"} />
                        <Badge label={`unsupported ${score.unsupportedSymbols.length}`} tone={score.unsupportedSymbols.length > 0 ? "red" : "gray"} />
                        <Badge label={`context ${score.contextDependentSymbols.length}`} tone={score.contextDependentSymbols.length > 0 ? "gray" : "gray"} />
                      </div>
                    </div>
                    <div className="mt-4 overflow-x-auto rounded-md border border-white/10">
                      <table className="min-w-[1250px] w-full border-collapse text-left text-xs">
                        <thead className="bg-white/[0.04] text-slate-400">
                          <tr>
                            {[
                              "Symbol",
                              "Name",
                              "Status",
                              "Obs",
                              "Latest",
                              "Transform",
                              "Lookback",
                              "Window",
                              "Min Obs",
                              "Norm",
                              "Z",
                              "Raw",
                              "Contribution",
                              "Message",
                            ].map((column) => (
                              <th key={column} className="px-3 py-2 font-medium">
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {score.factors.map((factor) => (
                            <tr key={`${score.scoreKey}-${factor.symbol}-${factor.status}`} className="text-slate-300">
                              <td className="px-3 py-2 font-mono text-slate-100">{factor.symbol}</td>
                              <td className="px-3 py-2">{factor.name}</td>
                              <td className="px-3 py-2">
                                <Badge label={factor.status} tone={statusTone(factor.status)} />
                              </td>
                              <td className="px-3 py-2">{factor.observationCount}</td>
                              <td className="px-3 py-2">{factor.latestDate ?? "—"}</td>
                              <td className="px-3 py-2">{factor.signalTransform ?? "—"}</td>
                              <td className="px-3 py-2">{factor.transformLookbackDays ?? "—"}</td>
                              <td className="px-3 py-2">{factor.preferredWindow ?? "—"}</td>
                              <td className="px-3 py-2">{factor.minObservations ?? "—"}</td>
                              <td className="px-3 py-2">{formatDebugNumber(factor.normalizedSignal)}</td>
                              <td className="px-3 py-2">{formatDebugNumber(factor.zScore)}</td>
                              <td className="px-3 py-2">{formatDebugNumber(factor.rawValue, { signed: false })}</td>
                              <td className="px-3 py-2">{formatDebugNumber(factor.contribution)}</td>
                              <td className="max-w-[320px] px-3 py-2 text-slate-500">{factor.message ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
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
