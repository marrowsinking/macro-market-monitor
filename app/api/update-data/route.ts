import { NextResponse } from "next/server";
import { runFullDataUpdate } from "@/lib/dataUpdateJobs";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const report = await runFullDataUpdate(prisma);

    return NextResponse.json({
      success: true,
      fred: {
        provider: report.fred.provider,
        indicatorsChecked: report.fred.indicatorsChecked,
        success: report.fred.success,
        failed: report.fred.failed,
        observationsInserted: report.fred.observationsInserted,
        observationsSkipped: report.fred.observationsSkipped,
        errors: report.fred.errors,
      },
      yahoo: {
        provider: report.yahoo.provider,
        indicatorsChecked: report.yahoo.indicatorsChecked,
        success: report.yahoo.success,
        failed: report.yahoo.failed,
        observationsInserted: report.yahoo.observationsInserted,
        observationsSkipped: report.yahoo.observationsSkipped,
        errors: report.yahoo.errors,
      },
      finalRegime: report.regime.finalRegime,
      alertsCount: report.alerts.triggered,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
