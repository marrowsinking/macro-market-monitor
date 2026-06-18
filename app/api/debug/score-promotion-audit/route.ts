import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  collectConfiguredSymbolUsage,
  createDataCoverageDebugPayload,
} from "@/lib/debug/dataCoverageDebugService";
import {
  NFCI_BENCHMARK_SYMBOLS,
  createNfciBenchmarkPayload,
  type NfciBenchmarkSymbol,
  type NfciObservationPoint,
} from "@/lib/debug/nfciBenchmarkService";
import {
  createScoreComparisonPayload,
  currentScoresFromMacroRegime,
} from "@/lib/debug/scoreComparisonDebugService";
import { createScorePromotionAuditPayload } from "@/lib/debug/scorePromotionAuditService";
import {
  buildObservationSeriesMap,
  collectRequiredShadowSymbols,
  createShadowScoreDebugPayload,
} from "@/lib/engines/shadowScoreDebugService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadScoreComparison() {
  const requestedSymbols = collectRequiredShadowSymbols();
  const indicators = await prisma.indicator.findMany({
    where: { symbol: { in: requestedSymbols } },
    include: {
      observations: {
        orderBy: { date: "asc" },
      },
    },
    orderBy: { symbol: "asc" },
  });
  const rows = indicators.flatMap((indicator) =>
    indicator.observations.map((observation) => ({
      symbol: indicator.symbol,
      date: observation.date,
      value: observation.value,
    })),
  );
  const observationsBySymbol = buildObservationSeriesMap(rows);
  const shadowPayload = createShadowScoreDebugPayload({
    observationsBySymbol,
    requestedSymbols,
    availableSymbols: Object.keys(observationsBySymbol),
  });
  const latest = await prisma.macroRegime.findFirst({
    orderBy: { date: "desc" },
  });
  const v1Scores = currentScoresFromMacroRegime(latest);
  const warnings = latest ? [...shadowPayload.warnings] : [...shadowPayload.warnings, "Failed to load current v1 scores."];

  return createScoreComparisonPayload({
    v1: {
      status: latest ? "ok" : "unavailable",
      source: "MacroRegime.latest",
      scores: v1Scores,
    },
    v2Scores: shadowPayload.scores,
    observationsBySymbol,
    warnings,
  });
}

async function loadDataCoverage() {
  const configuredSymbols = collectConfiguredSymbolUsage();
  const indicators = await prisma.indicator.findMany({
    where: {
      symbol: { in: configuredSymbols.map((item) => item.symbol) },
    },
    include: {
      observations: {
        select: { date: true },
        orderBy: { date: "asc" },
      },
    },
    orderBy: { symbol: "asc" },
  });
  const dbStats = indicators.map((indicator) => {
    const first = indicator.observations[0] ?? null;
    const latest = indicator.observations.at(-1) ?? null;
    return {
      symbol: indicator.symbol,
      observationCount: indicator.observations.length,
      firstDate: first?.date ?? null,
      latestDate: latest?.date ?? null,
    };
  });

  return createDataCoverageDebugPayload({ configuredSymbols, dbStats });
}

async function loadNfciBenchmark() {
  const indicators = await prisma.indicator.findMany({
    where: { symbol: { in: [...NFCI_BENCHMARK_SYMBOLS] } },
    include: {
      observations: {
        orderBy: { date: "asc" },
      },
    },
    orderBy: { symbol: "asc" },
  });
  const benchmarkObservationsBySymbol = indicators.reduce((acc, indicator) => {
    if (!NFCI_BENCHMARK_SYMBOLS.includes(indicator.symbol as NfciBenchmarkSymbol)) return acc;
    acc[indicator.symbol as NfciBenchmarkSymbol] = indicator.observations.map((observation) => ({
      date: observation.date,
      value: observation.value,
    }));
    return acc;
  }, {} as Partial<Record<NfciBenchmarkSymbol, NfciObservationPoint[]>>);

  const requestedSymbols = collectRequiredShadowSymbols();
  const shadowIndicators = await prisma.indicator.findMany({
    where: { symbol: { in: requestedSymbols } },
    include: {
      observations: {
        orderBy: { date: "asc" },
      },
    },
  });
  const shadowRows = shadowIndicators.flatMap((indicator) =>
    indicator.observations.map((observation) => ({
      symbol: indicator.symbol,
      date: observation.date,
      value: observation.value,
    })),
  );
  const observationsBySymbol = buildObservationSeriesMap(shadowRows);
  const shadowPayload = createShadowScoreDebugPayload({
    observationsBySymbol,
    requestedSymbols,
    availableSymbols: Object.keys(observationsBySymbol),
  });
  const scoreValue = (key: "liquidity_score" | "credit_score" | "risk_appetite_score") =>
    shadowPayload.scores[key].status === "no_data" || shadowPayload.scores[key].status === "not_scored"
      ? null
      : shadowPayload.scores[key].value;

  return createNfciBenchmarkPayload({
    benchmarkObservationsBySymbol,
    shadowScores: {
      liquidity_score: scoreValue("liquidity_score"),
      credit_score: scoreValue("credit_score"),
      risk_appetite_score: scoreValue("risk_appetite_score"),
    },
  });
}

export async function GET() {
  const globalNotes: string[] = [];
  const [comparisonResult, dataCoverageResult, nfciResult] = await Promise.allSettled([
    loadScoreComparison(),
    loadDataCoverage(),
    loadNfciBenchmark(),
  ]);

  if (comparisonResult.status === "rejected") {
    globalNotes.push(`Score comparison unavailable: ${comparisonResult.reason instanceof Error ? comparisonResult.reason.message : "Unknown error"}`);
  }
  if (dataCoverageResult.status === "rejected") {
    globalNotes.push(`Data coverage unavailable: ${dataCoverageResult.reason instanceof Error ? dataCoverageResult.reason.message : "Unknown error"}`);
  }
  if (nfciResult.status === "rejected") {
    globalNotes.push(`NFCI benchmark unavailable: ${nfciResult.reason instanceof Error ? nfciResult.reason.message : "Unknown error"}`);
  }

  return NextResponse.json(
    createScorePromotionAuditPayload({
      comparison: comparisonResult.status === "fulfilled" ? comparisonResult.value : null,
      dataCoverage: dataCoverageResult.status === "fulfilled" ? dataCoverageResult.value : null,
      nfciBenchmark: nfciResult.status === "fulfilled" ? nfciResult.value : null,
      inputNotes: globalNotes,
    }),
  );
}
