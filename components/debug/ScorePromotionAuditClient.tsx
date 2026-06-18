"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import type {
  PromotionDecision,
  ScorePromotionAuditResult,
  ScorePromotionAuditRow,
} from "@/lib/debug/scorePromotionAuditService";
import { formatDebugNumber } from "@/lib/debug/shadowScoreDebugView";

type Tone = "green" | "teal" | "amber" | "red" | "gray";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAuditPayload(value: unknown): value is ScorePromotionAuditResult {
  return isRecord(value) && value.engineVersion === "score-promotion-audit-debug" && Array.isArray(value.scores) && isRecord(value.summary);
}

function toneClass(tone: Tone): string {
  if (tone === "green") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  if (tone === "teal") return "border-cyan-500/20 bg-cyan-500/10 text-cyan-300";
  if (tone === "amber") return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  if (tone === "red") return "border-rose-500/20 bg-rose-500/10 text-rose-300";
  return "border-white/10 bg-white/5 text-slate-400";
}

function decisionTone(decision: PromotionDecision): Tone {
  if (decision === "ready") return "green";
  if (decision === "ready_with_monitoring") return "teal";
  if (decision === "needs_definition_audit") return "amber";
  if (decision === "needs_data_improvement" || decision === "not_ready") return "red";
  return "gray";
}

function healthTone(status: ScorePromotionAuditRow["dataHealth"]["status"]): Tone {
  if (status === "healthy") return "green";
  if (status === "warning") return "amber";
  return "red";
}

function confidenceTone(confidence: ScorePromotionAuditRow["confidence"]): Tone {
  if (confidence === "high") return "green";
  if (confidence === "medium") return "amber";
  return "gray";
}

function benchmarkTone(alignment: string): Tone {
  if (alignment === "aligned") return "green";
  if (alignment === "divergent") return "red";
  if (alignment === "mixed") return "amber";
  return "gray";
}

function Badge({ label, tone }: { label: string; tone: Tone }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneClass(tone)}`}>{label}</span>;
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  return (
    <div className={`rounded-lg border p-4 ${toneClass(tone)}`}>
      <div className="text-xs uppercase tracking-wide opacity-75">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function BulletList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-1 text-sm text-slate-300">
      {items.map((item) => (
        <li key={item}>- {item}</li>
      ))}
    </ul>
  );
}

function ScoreDetails({ row }: { row: ScorePromotionAuditRow }) {
  return (
    <div className="grid gap-4 border-t border-white/10 bg-ink-950/50 p-4 lg:grid-cols-2">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reasons</h3>
        <div className="mt-2">
          <BulletList items={row.reasons} empty="No reasons recorded." />
        </div>
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Blockers</h3>
        <div className="mt-2">
          <BulletList items={row.blockers} empty="No blockers." />
        </div>
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Affected Symbols</h3>
        <p className="mt-2 font-mono text-sm text-slate-300">{row.dataHealth.affectedSymbols.length > 0 ? row.dataHealth.affectedSymbols.join(", ") : "—"}</p>
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Factor Health</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge label={`scored ${row.factorHealth.scoredFactorCount}`} tone="green" />
          <Badge label={`context ${row.factorHealth.contextDependentCount}`} tone={row.factorHealth.contextDependentCount > 0 ? "amber" : "gray"} />
          <Badge label={`not scored ${row.factorHealth.notScoredCount}`} tone={row.factorHealth.notScoredCount > 0 ? "gray" : "gray"} />
          <Badge label={`unavailable ${row.factorHealth.unavailableFactorCount}`} tone={row.factorHealth.unavailableFactorCount > 0 ? "red" : "gray"} />
        </div>
        {row.factorHealth.notes.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-slate-500">
            {row.factorHealth.notes.map((note) => (
              <li key={note}>- {note}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {row.benchmark ? (
        <div className="lg:col-span-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Benchmark Note</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300">
            <span>{row.benchmark.name}</span>
            <Badge label={row.benchmark.alignment} tone={benchmarkTone(row.benchmark.alignment)} />
            <span>value {formatDebugNumber(row.benchmark.benchmarkValue)}</span>
          </div>
          <p className="mt-2 text-sm text-slate-500">{row.benchmark.note}</p>
        </div>
      ) : null}
      <div className="lg:col-span-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended Next Action</h3>
        <p className="mt-2 text-sm text-slate-300">{row.recommendedNextAction}</p>
      </div>
    </div>
  );
}

export function ScorePromotionAuditClient() {
  const [payload, setPayload] = useState<ScorePromotionAuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);

  const loadAudit = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const response = await fetch("/api/debug/score-promotion-audit", { cache: "no-store" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = isRecord(body) && typeof body.message === "string" ? body.message : "Failed to load score promotion audit";
        throw new Error(message);
      }
      if (!isAuditPayload(body)) {
        throw new Error("Invalid score promotion audit response.");
      }
      setPayload(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load score promotion audit");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  const toggle = (scoreKey: string) => {
    setExpanded((current) => (current.includes(scoreKey) ? current.filter((item) => item !== scoreKey) : [...current, scoreKey]));
  };

  return (
    <main className="space-y-6">
      <section className="rounded-xl border border-white/10 bg-ink-900/70 p-5 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Score Promotion Audit</h1>
            <p className="mt-1 text-sm text-slate-400">Debug-only readiness check for promoting v2 shadow scores into official scoring.</p>
            <div className="mt-4 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              This page does not affect official dashboard, confirmed regime, alerts, or score calculation.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadAudit()}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-market-teal/40 px-3 py-2 text-sm font-medium text-market-teal transition hover:bg-market-teal/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        {payload ? (
          <p className="mt-4 text-xs text-slate-500">
            generatedAt: {payload.generatedAt} · engineVersion: {payload.engineVersion}
          </p>
        ) : null}
      </section>

      {loading ? <div className="rounded-xl border border-white/10 bg-ink-900/70 p-5 text-sm text-slate-400">Loading score promotion audit...</div> : null}

      {error ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-5">
          <h2 className="text-base font-semibold text-rose-200">Failed to load score promotion audit</h2>
          <p className="mt-2 text-sm text-rose-100">{error}</p>
        </div>
      ) : null}

      {payload ? (
        <>
          <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            <MetricCard label="Ready" value={payload.summary.ready} tone="green" />
            <MetricCard label="Ready with Monitoring" value={payload.summary.readyWithMonitoring} tone="teal" />
            <MetricCard label="Needs Definition Audit" value={payload.summary.needsDefinitionAudit} tone="amber" />
            <MetricCard label="Needs Data Improvement" value={payload.summary.needsDataImprovement} tone="red" />
            <MetricCard label="Not Ready" value={payload.summary.notReady} tone="gray" />
          </section>

          {payload.globalNotes.length > 0 ? (
            <section className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-5">
              <h2 className="text-base font-semibold text-amber-100">Global Notes</h2>
              <div className="mt-3 space-y-2">
                {payload.globalNotes.map((note) => (
                  <div key={note} className="rounded-md border border-amber-500/20 bg-ink-950/30 px-3 py-2 text-sm text-amber-100">
                    {note}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border border-white/10 bg-ink-900/70 p-5">
            <h2 className="text-base font-semibold text-white">Audit Table</h2>
            <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
              <table className="min-w-[1200px] w-full border-collapse text-left text-xs">
                <thead className="bg-white/[0.04] text-slate-400">
                  <tr>
                    {["Score", "Decision", "Confidence", "V1", "V2", "Difference", "Direction", "Data Health", "Benchmark", "Recommended Next Action"].map((column) => (
                      <th key={column} className="px-3 py-2 font-medium">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {payload.scores.map((row) => (
                    <tr key={row.scoreKey} className="text-slate-300">
                      <td className="px-3 py-2">
                        <div className="font-semibold text-white">{row.label}</div>
                        <div className="font-mono text-[11px] text-slate-500">{row.scoreKey}</div>
                      </td>
                      <td className="px-3 py-2"><Badge label={row.decision} tone={decisionTone(row.decision)} /></td>
                      <td className="px-3 py-2"><Badge label={row.confidence} tone={confidenceTone(row.confidence)} /></td>
                      <td className="px-3 py-2">{formatDebugNumber(row.v1)}</td>
                      <td className="px-3 py-2">{formatDebugNumber(row.v2)}</td>
                      <td className="px-3 py-2">{formatDebugNumber(row.difference)}</td>
                      <td className="px-3 py-2">{row.directionAgreement ?? "—"}</td>
                      <td className="px-3 py-2"><Badge label={row.dataHealth.status} tone={healthTone(row.dataHealth.status)} /></td>
                      <td className="px-3 py-2">
                        {row.benchmark ? <Badge label={row.benchmark.alignment} tone={benchmarkTone(row.benchmark.alignment)} /> : "—"}
                      </td>
                      <td className="max-w-[320px] px-3 py-2 text-slate-500">{row.recommendedNextAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Score Detail Accordions</h2>
              <div className="flex gap-3 text-xs">
                <button type="button" onClick={() => setExpanded(payload.scores.map((row) => row.scoreKey))} className="text-market-teal hover:text-market-teal/80">
                  Expand all
                </button>
                <button type="button" onClick={() => setExpanded([])} className="text-slate-400 hover:text-slate-200">
                  Collapse all
                </button>
              </div>
            </div>
            {payload.scores.map((row) => {
              const isExpanded = expanded.includes(row.scoreKey);
              return (
                <div key={row.scoreKey} className={`overflow-hidden rounded-xl border ${isExpanded ? "border-market-teal/30" : "border-white/10"} bg-ink-900/70`}>
                  <button
                    type="button"
                    onClick={() => toggle(row.scoreKey)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center gap-3">
                      <ChevronDown size={16} className={`text-slate-400 transition ${isExpanded ? "rotate-180" : "-rotate-90"}`} />
                      <div>
                        <div className="text-sm font-semibold text-white">{row.label}</div>
                        <div className="font-mono text-xs text-slate-500">{row.scoreKey}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Badge label={row.decision} tone={decisionTone(row.decision)} />
                      <span className="text-xs text-slate-500">{isExpanded ? "Click to collapse" : "Click to expand"}</span>
                    </div>
                  </button>
                  {isExpanded ? <ScoreDetails row={row} /> : null}
                </div>
              );
            })}
          </section>
        </>
      ) : null}
    </main>
  );
}
