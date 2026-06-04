import { loadEnvConfig } from "@next/env";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";
import { runYahooDataUpdate } from "../lib/dataUpdateJobs";
import type { FetchJobResult } from "../lib/providers/types";

loadEnvConfig(process.cwd());

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" });
const prisma = new PrismaClient({ adapter });

function printFetchJobResult(result: FetchJobResult) {
  console.log(`${result.provider} fetch completed:`);
  console.log(`- indicators checked: ${result.indicatorsChecked}`);
  console.log(`- success: ${result.success}`);
  console.log(`- failed: ${result.failed}`);
  console.log(`- observations inserted: ${result.observationsInserted}`);
  console.log(`- observations skipped: ${result.observationsSkipped}`);
  if (result.errors.length > 0) {
    console.log("- errors:");
    for (const error of result.errors) {
      console.log(`  - ${error.symbol}: ${error.type} ${error.message}`);
    }
  }
}

async function main() {
  const report = await runYahooDataUpdate(prisma, console.log);
  printFetchJobResult(report);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
