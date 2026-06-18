"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { NfciAlignment, NfciBenchmarkPayload, NfciBenchmarkPoint } from "@/lib/debug/nfciBenchmarkService";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNfciBenchmarkPayload(value: unknown): value is NfciBenchmarkPayload {
  return isRecord(value) && value.engineVersion === "nfci-benchmark-debug" && isRecord(value.benchmark) && isRecord(value.alignment);
}

function formatNumber(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(2);
}

function statusClass(status: NfciBenchmarkPoint["status"]): string {
  if (status === "ok") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  return "border-amber-500/20 bg-amber-500/10 text-amber-300";
}

function alignmentClass(alignment: NfciAlignment): string {
  if (alignment === "aligned") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  if (alignment === "divergent") return "border-rose-500/20 bg-rose-500/10 text-rose-300";
  return "border-white/10 bg-white/5 text-slate-400";
}

function BenchmarkCard({ item }: { item: NfciBenchmarkPoint }) {
  return (
    <div className="rounded-lg border border-white/10 bg-ink-900/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-sm font-semibold text-white">{item.symbol}</div>
          <div className="mt-1 text-xs text-slate-500">{item.name}</div>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass(item.status)}`}>{item.status}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div>
          <div className="text-slate-500">Latest</div>
          <div className="mt-1 font-semibold text-slate-100">{formatNumber(item.latestValue)}</div>
        </div>
        <div>
          <div className="text-slate-500">Z-score</div>
          <div className="mt-1 font-semibold text-slate-100">{formatNumber(item.zScore)}</div>
        </div>
        <div>
          <div className="text-slate-500">Date</div>
          <div className="mt-1 font-semibold text-slate-100">{item.latestDate ?? "—"}</div>
        </div>
      </div>
      {item.message ? <div className="mt-3 text-xs text-amber-200">{item.message}</div> : null}
    </div>
  );
}

export function NfciBenchmarkDebugClient() {
  const [payload, setPayload] = useState<NfciBenchmarkPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPayload = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const response = await fetch("/api/debug/nfci-benchmark", { cache: "no-store" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = isRecord(body) && typeof body.message === "string" ? body.message : "Failed to load NFCI benchmark diagnostics";
        throw new Error(message);
      }
      if (!isNfciBenchmarkPayload(body)) {
        throw new Error("Invalid NFCI benchmark response.");
      }
      setPayload(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load NFCI benchmark diagnostics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadPayload();
  }, [loadPayload]);

  const benchmarkCards = payload
    ? [payload.benchmark.nfci, payload.benchmark.anfci, payload.benchmark.risk, payload.benchmark.credit, payload.benchmark.leverage]
    : [];

  return (
    <main className="space-y-6">
      <section className="rounded-xl border border-white/10 bg-ink-900/70 p-5 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">NFCI Benchmark</h1>
            <p className="mt-1 text-sm text-slate-400">Chicago Fed financial conditions benchmark for debug and promotion audit only.</p>
            <div className="mt-4 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              Debug only. This page does not affect the official Dashboard, confirmed regime, alerts, or score calculation.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadPayload()}
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

      {loading ? <div className="rounded-xl border border-white/10 bg-ink-900/70 p-5 text-sm text-slate-400">Loading NFCI benchmark diagnostics...</div> : null}

      {error ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-5">
          <h2 className="text-base font-semibold text-rose-200">Failed to load NFCI benchmark diagnostics</h2>
          <p className="mt-2 text-sm text-rose-100">{error}</p>
        </div>
      ) : null}

      {payload ? (
        <>
          {benchmarkCards.some((item) => item.status === "unavailable") ? (
            <section className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-100">
              NFCI benchmark data is missing or incomplete. Run <span className="font-mono">npm run seed</span> and{" "}
              <span className="font-mono">npm run fetch:fred</span>.
            </section>
          ) : null}

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {benchmarkCards.map((item) => (
              <BenchmarkCard key={item.symbol} item={item} />
            ))}
          </section>

          <section className="rounded-xl border border-white/10 bg-ink-900/70 p-5">
            <h2 className="text-base font-semibold text-white">Alignment</h2>
            <p className="mt-1 text-xs text-slate-500">NFCI direction is inverted: positive NFCI means tighter conditions.</p>
            <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
              <table className="min-w-[760px] w-full border-collapse text-left text-xs">
                <thead className="bg-white/[0.04] text-slate-400">
                  <tr>
                    {["Comparison", "Shadow Score", "Benchmark", "Alignment"].map((column) => (
                      <th key={column} className="px-3 py-2 font-medium">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-slate-300">
                  {[
                    ["Liquidity vs -NFCI", payload.shadowScores.liquidity_score, payload.benchmark.nfci.latestValue, payload.alignment.liquidityVsNfci],
                    ["Credit vs -NFCICREDIT", payload.shadowScores.credit_score, payload.benchmark.credit.latestValue, payload.alignment.creditVsNfciCredit],
                    ["Risk Appetite vs -NFCIRISK", payload.shadowScores.risk_appetite_score, payload.benchmark.risk.latestValue, payload.alignment.riskAppetiteVsNfciRisk],
                  ].map(([label, score, benchmark, alignment]) => (
                    <tr key={String(label)}>
                      <td className="px-3 py-2 font-medium text-slate-100">{label}</td>
                      <td className="px-3 py-2">{formatNumber(score as number | null)}</td>
                      <td className="px-3 py-2">{formatNumber(benchmark as number | null)}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${alignmentClass(alignment as NfciAlignment)}`}>
                          {String(alignment)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-ink-900/70 p-5">
            <h2 className="text-base font-semibold text-white">Notes</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {payload.notes.map((note) => (
                <li key={note}>- {note}</li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </main>
  );
}
