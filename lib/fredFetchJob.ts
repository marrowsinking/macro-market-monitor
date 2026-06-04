import type { FredObservation } from "@/lib/fred";

export type FredFetchIndicator = {
  id: number;
  symbol: string;
  fredSeriesId: string | null;
};

export type FredFetchFailure = {
  symbol: string;
  seriesId: string;
  reason: string;
};

export type FredFetchReport = {
  indicatorsChecked: number;
  success: number;
  failed: number;
  observationsInserted: number;
  failures: FredFetchFailure[];
};

export type FredFetchJobOptions = {
  apiKey: string;
  observationStart: string;
  indicators: FredFetchIndicator[];
  fetchObservations: (
    seriesId: string,
    options: { apiKey: string; observationStart: string },
  ) => Promise<FredObservation[]>;
  observationExists: (indicatorId: number, date: Date) => Promise<boolean>;
  insertObservation: (data: { indicatorId: number; date: Date; value: number }) => Promise<void>;
  log?: (message: string) => void;
};

function errorReason(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function formatFredFetchReport(report: FredFetchReport): string {
  const lines = [
    "Fetch completed:",
    `- indicators checked: ${report.indicatorsChecked}`,
    `- success: ${report.success}`,
    `- failed: ${report.failed}`,
    `- observations inserted: ${report.observationsInserted}`,
  ];

  if (report.failures.length > 0) {
    lines.push("- failures:");
    for (const failure of report.failures) {
      lines.push(`  - ${failure.symbol} (${failure.seriesId}): ${failure.reason}`);
    }
  }

  return lines.join("\n");
}

export async function runFredFetchJob(options: FredFetchJobOptions): Promise<FredFetchReport> {
  const report: FredFetchReport = {
    indicatorsChecked: options.indicators.length,
    success: 0,
    failed: 0,
    observationsInserted: 0,
    failures: [],
  };

  for (const indicator of options.indicators) {
    if (!indicator.fredSeriesId) continue;
    options.log?.(`Fetching ${indicator.symbol} (${indicator.fredSeriesId})...`);

    try {
      const observations = await options.fetchObservations(indicator.fredSeriesId, {
        apiKey: options.apiKey,
        observationStart: options.observationStart,
      });

      for (const observation of observations) {
        const date = new Date(`${observation.date}T00:00:00.000Z`);
        const exists = await options.observationExists(indicator.id, date);
        if (exists) continue;

        await options.insertObservation({
          indicatorId: indicator.id,
          date,
          value: observation.value,
        });
        report.observationsInserted += 1;
      }

      report.success += 1;
    } catch (error) {
      report.failed += 1;
      report.failures.push({
        symbol: indicator.symbol,
        seriesId: indicator.fredSeriesId,
        reason: errorReason(error),
      });
    }
  }

  return report;
}
