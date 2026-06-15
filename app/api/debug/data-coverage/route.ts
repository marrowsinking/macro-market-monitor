import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  collectConfiguredSymbolUsage,
  createDataCoverageDebugPayload,
} from "@/lib/debug/dataCoverageDebugService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
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

    return NextResponse.json(createDataCoverageDebugPayload({ configuredSymbols, dbStats }));
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load data coverage diagnostics",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
