import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  NFCI_BENCHMARK_SYMBOLS,
  createNfciBenchmarkPayload,
  type NfciBenchmarkSymbol,
  type NfciObservationPoint,
} from "@/lib/debug/nfciBenchmarkService";
import {
  buildObservationSeriesMap,
  collectRequiredShadowSymbols,
  createShadowScoreDebugPayload,
} from "@/lib/engines/shadowScoreDebugService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadBenchmarkObservations(): Promise<Partial<Record<NfciBenchmarkSymbol, NfciObservationPoint[]>>> {
  const indicators = await prisma.indicator.findMany({
    where: { symbol: { in: [...NFCI_BENCHMARK_SYMBOLS] } },
    include: {
      observations: {
        orderBy: { date: "asc" },
      },
    },
    orderBy: { symbol: "asc" },
  });

  return indicators.reduce((acc, indicator) => {
    if (!NFCI_BENCHMARK_SYMBOLS.includes(indicator.symbol as NfciBenchmarkSymbol)) return acc;
    acc[indicator.symbol as NfciBenchmarkSymbol] = indicator.observations.map((observation) => ({
      date: observation.date,
      value: observation.value,
    }));
    return acc;
  }, {} as Partial<Record<NfciBenchmarkSymbol, NfciObservationPoint[]>>);
}

async function loadShadowScores() {
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
  const payload = createShadowScoreDebugPayload({
    observationsBySymbol,
    requestedSymbols,
    availableSymbols: Object.keys(observationsBySymbol),
  });

  const scoreValue = (key: "liquidity_score" | "credit_score" | "risk_appetite_score") =>
    payload.scores[key].status === "no_data" || payload.scores[key].status === "not_scored" ? null : payload.scores[key].value;

  return {
    liquidity_score: scoreValue("liquidity_score"),
    credit_score: scoreValue("credit_score"),
    risk_appetite_score: scoreValue("risk_appetite_score"),
  };
}

export async function GET() {
  try {
    const [benchmarkObservationsBySymbol, shadowScores] = await Promise.all([
      loadBenchmarkObservations(),
      loadShadowScores().catch(() => ({
        liquidity_score: null,
        credit_score: null,
        risk_appetite_score: null,
      })),
    ]);

    return NextResponse.json(createNfciBenchmarkPayload({ benchmarkObservationsBySymbol, shadowScores }));
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load NFCI benchmark diagnostics",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
