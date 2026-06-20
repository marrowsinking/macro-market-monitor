import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildStressWindowReplayResult } from "@/lib/debug/stressWindowReplayService";
import {
  buildObservationSeriesMap,
  collectRequiredShadowSymbols,
} from "@/lib/engines/shadowScoreDebugService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseNumber(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedSymbols = collectRequiredShadowSymbols();
    const indicators = await prisma.indicator.findMany({
      where: {
        symbol: { in: requestedSymbols },
      },
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

    return NextResponse.json(
      await buildStressWindowReplayResult({
        observationsBySymbol,
        requestedWindow: url.searchParams.get("window") ?? "all",
        step: parseNumber(url.searchParams.get("step")),
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to run stress window replay",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
