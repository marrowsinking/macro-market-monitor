import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildObservationSeriesMap,
  collectRequiredShadowSymbols,
  createShadowScoreDebugPayload,
} from "@/lib/engines/shadowScoreDebugService";
import {
  createScoreComparisonPayload,
  currentScoresFromMacroRegime,
} from "@/lib/debug/scoreComparisonDebugService";

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

async function loadShadowScores(options: {
  preferredWindow?: number;
  zScoreForFullSignal?: number;
}) {
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
    throw new Error("No database indicators match configured shadow score symbols.");
  }

  const rows = indicators.flatMap((indicator) =>
    indicator.observations.map((observation) => ({
      symbol: indicator.symbol,
      date: observation.date,
      value: observation.value,
    })),
  );
  if (rows.length === 0) {
    throw new Error("Matching indicators exist, but they do not have observations.");
  }

  const observationsBySymbol = buildObservationSeriesMap(rows);
  return createShadowScoreDebugPayload({
    observationsBySymbol,
    requestedSymbols,
    availableSymbols: Object.keys(observationsBySymbol),
    options,
  });
}

async function loadCurrentV1Scores() {
  const latest = await prisma.macroRegime.findFirst({
    orderBy: { date: "desc" },
  });

  if (!latest) {
    return {
      status: "unavailable" as const,
      source: "MacroRegime.latest",
      scores: currentScoresFromMacroRegime(null),
      warning: "Failed to load current v1 scores.",
    };
  }

  return {
    status: "ok" as const,
    source: "MacroRegime.latest",
    scores: currentScoresFromMacroRegime(latest),
    warning: null,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const preferredWindow = parsePositiveNumber(url.searchParams.get("preferredWindow"), "preferredWindow");
  if (preferredWindow instanceof Response) return preferredWindow;
  const zScoreForFullSignal = parsePositiveNumber(url.searchParams.get("zScoreForFullSignal"), "zScoreForFullSignal");
  if (zScoreForFullSignal instanceof Response) return zScoreForFullSignal;

  try {
    const shadow = await loadShadowScores({ preferredWindow, zScoreForFullSignal });
    const warnings = [...shadow.warnings];
    let v1:
      | Awaited<ReturnType<typeof loadCurrentV1Scores>>
      | {
          status: "unavailable";
          source: "MacroRegime.latest";
          scores: ReturnType<typeof currentScoresFromMacroRegime>;
          warning: string;
        };

    try {
      v1 = await loadCurrentV1Scores();
    } catch {
      v1 = {
        status: "unavailable",
        source: "MacroRegime.latest",
        scores: currentScoresFromMacroRegime(null),
        warning: "Failed to load current v1 scores.",
      };
    }

    if (v1.warning) warnings.push(v1.warning);

    return NextResponse.json(
      createScoreComparisonPayload({
        v1: {
          status: v1.status,
          source: v1.source,
          scores: v1.scores,
        },
        v2Scores: shadow.scores,
        options: {
          preferredWindow,
          zScoreForFullSignal,
        },
        warnings,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to calculate score comparison",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
