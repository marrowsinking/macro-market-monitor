import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildObservationSeriesMap,
  collectRequiredShadowSymbols,
  createShadowScoreDebugPayload,
  createShadowScoreSummary,
} from "@/lib/engines/shadowScoreDebugService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePositiveNumber(value: string | null, name: string): number | undefined | Response {
  if (value === null) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return NextResponse.json({ error: `${name} must be a positive number.` }, { status: 400 });
  }
  return parsed;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const preferredWindow = parsePositiveNumber(url.searchParams.get("preferredWindow"), "preferredWindow");
  if (preferredWindow instanceof Response) return preferredWindow;
  const zScoreForFullSignal = parsePositiveNumber(url.searchParams.get("zScoreForFullSignal"), "zScoreForFullSignal");
  if (zScoreForFullSignal instanceof Response) return zScoreForFullSignal;

  try {
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

    if (indicators.length === 0) {
      return NextResponse.json(
        {
          error: "No matching indicators found",
          message: "No database indicators match configured shadow score symbols.",
          requestedSymbols,
        },
        { status: 404 },
      );
    }

    const rows = indicators.flatMap((indicator) =>
      indicator.observations.map((observation) => ({
        symbol: indicator.symbol,
        date: observation.date,
        value: observation.value,
      })),
    );
    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: "No observations found",
          message: "Matching indicators exist, but they do not have observations.",
          requestedSymbols,
          matchedSymbols: indicators.map((indicator) => indicator.symbol),
        },
        { status: 404 },
      );
    }

    const observationsBySymbol = buildObservationSeriesMap(rows);
    const availableSymbols = Object.keys(observationsBySymbol);
    const payload = createShadowScoreDebugPayload({
      observationsBySymbol,
      requestedSymbols,
      availableSymbols,
      options: {
        preferredWindow,
        zScoreForFullSignal,
      },
    });

    return NextResponse.json(url.searchParams.get("summary") === "1" ? createShadowScoreSummary(payload) : payload);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to calculate shadow scores",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
