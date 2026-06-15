"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { CoverageStatus, DataCoverageDebugPayload } from "@/lib/debug/dataCoverageDebugService";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDataCoveragePayload(value: unknown): value is DataCoverageDebugPayload {
  return isRecord(value) && value.engineVersion === "data-coverage-debug" && isRecord(value.summary) && Array.isArray(value.rows);
}

function statusTone(status: CoverageStatus): "green" | "amber" | "red" | "gray" {
  if (status === "ok") return "green";
  if (status === "insufficient") return "amber";
  if (status === "missing" || status === "stale") return "red";
  return "gray";
}

function badgeClass(status: CoverageStatus): string {
  const tone = statusTone(status);
  if (tone === "green") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  if (tone === "amber") return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  if (tone === "red") return "border-rose-500/20 bg-rose-500/10 text-rose-300";
  return "border-white/10 bg-white/5 text-slate-400";
}

function StatusBadge({ status }: { status: CoverageStatus }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeClass(status)}`}>{status}</span>;
}

function MetricCard({ label, value, status }: { label: string; value: number; status?: CoverageStatus }) {
  return (
    <div className={`rounded-lg border p-4 ${status ? badgeClass(status) : "border-white/10 bg-white/[0.03] text-slate-100"}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export function DataCoverageDebugClient() {
  const [payload, setPayload] = useState<DataCoverageDebugPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<CoverageStatus | "all">("all");

  const loadCoverage = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const response = await fetch("/api/debug/data-coverage", { cache: "no-store" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = isRecord(body) && typeof body.message === "string" ? body.message : "Failed to load data coverage diagnostics";
        throw new Error(message);
      }
      if (!isDataCoveragePayload(body)) {
        throw new Error("Invalid data coverage response.");
      }
      setPayload(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data coverage diagnostics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadCoverage();
  }, [loadCoverage]);

  const rows = useMemo(() => {
    if (!payload) return [];
    return statusFilter === "all" ? payload.rows : payload.rows.filter((row) => row.status === statusFilter);
  }, [payload, statusFilter]);

  return (
    <main className="space-y-6">
      <section className="rounded-xl border border-white/10 bg-ink-900/70 p-5 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Data Coverage Diagnostic</h1>
            <p className="mt-1 text-sm text-slate-400">Configured macro factor coverage across database observations. Debug only.</p>
            <div className="mt-4 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              This page is for diagnostics only and does not affect official scores, regimes, or alerts.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadCoverage()}
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

      {loading ? <div className="rounded-xl border border-white/10 bg-ink-900/70 p-5 text-sm text-slate-400">Loading data coverage...</div> : null}

      {error ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-5">
          <h2 className="text-base font-semibold text-rose-200">Failed to load data coverage diagnostics</h2>
          <p className="mt-2 text-sm text-rose-100">{error}</p>
        </div>
      ) : null}

      {payload ? (
        <>
          <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
            <MetricCard label="Total Configured" value={payload.summary.totalConfiguredSymbols} />
            <MetricCard label="OK" value={payload.summary.okCount} status="ok" />
            <MetricCard label="Missing" value={payload.summary.missingCount} status="missing" />
            <MetricCard label="Insufficient" value={payload.summary.insufficientCount} status="insufficient" />
            <MetricCard label="Stale" value={payload.summary.staleCount} status="stale" />
            <MetricCard label="Derived" value={payload.summary.derivedCount} status="derived" />
            <MetricCard label="Placeholder" value={payload.summary.placeholderCount} status="placeholder" />
          </section>

          {payload.summary.highImpactIssues.length > 0 ? (
            <section className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-5">
              <h2 className="text-base font-semibold text-amber-100">High Impact Issues</h2>
              <div className="mt-4 overflow-x-auto rounded-lg border border-amber-500/20">
                <table className="min-w-[760px] w-full border-collapse text-left text-xs">
                  <thead className="bg-ink-950/40 text-amber-100">
                    <tr>
                      {["Symbol", "Status", "Affected Scores", "Message"].map((column) => (
                        <th key={column} className="px-3 py-2 font-medium">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-500/20">
                    {payload.summary.highImpactIssues.map((issue) => (
                      <tr key={issue.symbol} className="text-amber-100">
                        <td className="px-3 py-2 font-mono font-semibold">{issue.symbol}</td>
                        <td className="px-3 py-2"><StatusBadge status={issue.status} /></td>
                        <td className="px-3 py-2 font-mono text-[11px]">{issue.affectedScores.join(", ")}</td>
                        <td className="px-3 py-2">{issue.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {payload.warnings.length > 0 ? (
            <section className="space-y-2">
              {payload.warnings.map((warning) => (
                <div key={warning} className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                  {warning}
                </div>
              ))}
            </section>
          ) : null}

          <section className="rounded-xl border border-white/10 bg-ink-900/70 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Coverage Table</h2>
                <p className="mt-1 text-xs text-slate-500">Rows are pre-sorted: missing, insufficient and stale first; derived and placeholder later.</p>
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as CoverageStatus | "all")}
                className="rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-market-teal/50"
              >
                {["all", "missing", "insufficient", "stale", "ok", "derived", "placeholder", "not_scored"].map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
              <table className="min-w-[1500px] w-full border-collapse text-left text-xs">
                <thead className="bg-white/[0.04] text-slate-400">
                  <tr>
                    {[
                      "Symbol",
                      "Name",
                      "Source",
                      "Frequency",
                      "Status",
                      "Obs",
                      "First Date",
                      "Latest Date",
                      "Days Since Latest",
                      "Required Min Obs",
                      "Default Window",
                      "Transform",
                      "Lookback",
                      "Affected Scores",
                      "Message",
                    ].map((column) => (
                      <th key={column} className="px-3 py-2 font-medium">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {rows.map((row) => (
                    <tr key={row.symbol} className="text-slate-300">
                      <td className="px-3 py-2 font-mono text-slate-100">{row.symbol}</td>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2">{row.source ?? "—"}</td>
                      <td className="px-3 py-2">{row.frequency}</td>
                      <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
                      <td className="px-3 py-2">{row.observationCount}</td>
                      <td className="px-3 py-2">{row.firstDate ?? "—"}</td>
                      <td className="px-3 py-2">{row.latestDate ?? "—"}</td>
                      <td className="px-3 py-2">{row.daysSinceLatest ?? "—"}</td>
                      <td className="px-3 py-2">{row.requiredMinimumObservations}</td>
                      <td className="px-3 py-2">{row.preferredDefaultWindow ?? "—"}</td>
                      <td className="px-3 py-2">{row.signalTransform}</td>
                      <td className="px-3 py-2">{row.transformLookbackDays ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-[11px]">{row.affectedScores.join(", ")}</td>
                      <td className="max-w-[360px] px-3 py-2 text-slate-500">{row.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
