import { subYears } from "date-fns";
import { createYahooFetcher } from "../lib/providers/yahooProvider";
import {
  YAHOO_FX_ALIAS_CANDIDATES,
  buildYahooFxAliasDiagnostic,
  type YahooFxAliasDiagnosticResult,
} from "../lib/debug/yahooFxAliasDiagnostic";

function formatValue(value: number | null): string {
  return value === null ? "null" : String(value);
}

function printResult(result: YahooFxAliasDiagnosticResult) {
  console.log(`${result.symbol}`);
  console.log(`- status: ${result.status}${result.isRecommended ? " (Recommended candidate)" : ""}`);
  console.log(`- observationCount: ${result.observationCount}`);
  console.log(`- firstDate: ${result.firstDate ?? "null"}`);
  console.log(`- latestDate: ${result.latestDate ?? "null"}`);
  console.log(`- sampleFirstValue: ${formatValue(result.sampleFirstValue)}`);
  console.log(`- sampleLatestValue: ${formatValue(result.sampleLatestValue)}`);
  if (result.errorMessage) console.log(`- error: ${result.errorMessage}`);
}

async function main() {
  const endDate = new Date();
  const startDate = subYears(endDate, 10);
  const fetcher = createYahooFetcher({
    period1: startDate,
    period2: endDate,
    interval: "1d",
  });

  console.log("Yahoo FX alias diagnostic:");
  console.log(`- period: ${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`);
  console.log(`- candidates: ${YAHOO_FX_ALIAS_CANDIDATES.join(", ")}`);
  console.log("");

  const report = await buildYahooFxAliasDiagnostic({
    candidates: YAHOO_FX_ALIAS_CANDIDATES,
    fetchRows: async (symbol) => {
      const query = fetcher.transformQuery({ id: 0, symbol });
      return fetcher.extractData(query);
    },
  });

  for (const result of report.results) {
    printResult(result);
    console.log("");
  }

  console.log("Best candidates:");
  report.rankedResults.forEach((result, index) => {
    const recommendation = result.isRecommended ? " - Recommended candidate" : "";
    console.log(
      `${index + 1}. ${result.symbol} - ${result.observationCount} observations - ${result.firstDate ?? "null"} to ${
        result.latestDate ?? "null"
      } - ${result.status}${recommendation}`,
    );
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
