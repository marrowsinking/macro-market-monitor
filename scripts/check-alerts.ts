import { loadEnvConfig } from "@next/env";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";
import { runAlertCheck } from "../lib/dataUpdateJobs";

loadEnvConfig(process.cwd());

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  const report = await runAlertCheck(prisma);

  console.log("Alerts checked:");
  console.log(`- triggered: ${report.triggered}`);
  console.log(`- inserted: ${report.inserted}`);
  if (report.alerts.length > 0) {
    console.log("- alerts:");
    for (const item of report.alerts) {
      console.log(`  - ${item}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
