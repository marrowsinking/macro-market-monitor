import { loadEnvConfig } from "@next/env";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";
import { runFullDataUpdate } from "../lib/dataUpdateJobs";

loadEnvConfig(process.cwd());

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" });
const prisma = new PrismaClient({ adapter });

const targetHour = 8;
const targetMinute = 30;
let isRunning = false;

function formatDateTime(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function nextRunAt(from = new Date()): Date {
  const next = new Date(from);
  next.setHours(targetHour, targetMinute, 0, 0);
  if (next.getTime() <= from.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

async function runUpdateJob() {
  if (isRunning) {
    console.log(`[scheduler] ${formatDateTime(new Date())} previous update is still running, skipped.`);
    return;
  }

  isRunning = true;
  const startedAt = new Date();
  console.log(`[scheduler] update started at ${formatDateTime(startedAt)}`);

  try {
    const result = await runFullDataUpdate(prisma, (message) => console.log(`[scheduler] ${message}`));
    console.log("[scheduler] update completed:");
    console.log(`- FRED: ${result.fred.success}/${result.fred.indicatorsChecked} success, failed ${result.fred.failed}`);
    console.log(`- Yahoo: ${result.yahoo.success}/${result.yahoo.indicatorsChecked} success, failed ${result.yahoo.failed}`);
    console.log(`- finalRegime: ${result.regime.finalRegime}`);
    console.log(`- alerts inserted: ${result.alerts.inserted}`);
  } catch (error) {
    console.error(`[scheduler] update failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    isRunning = false;
  }
}

function scheduleNextRun() {
  const runAt = nextRunAt();
  const delay = runAt.getTime() - Date.now();
  console.log(`[scheduler] next update scheduled at ${formatDateTime(runAt)}`);

  setTimeout(() => {
    void runUpdateJob().finally(scheduleNextRun);
  }, delay);
}

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

scheduleNextRun();
