import { loadEnvConfig } from "@next/env";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";
import { runRegimeCalculation } from "../lib/dataUpdateJobs";

loadEnvConfig(process.cwd());

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  const regime = await runRegimeCalculation(prisma);

  console.log("Macro regime calculated:");
  console.log(`- finalRegime: ${regime.finalRegime}`);
  console.log(`- confirmedRegime: ${regime.confirmedRegimeState.confirmedRegime}`);
  console.log(`- rawRegimeSignal: ${regime.confirmedRegimeState.rawRegimeSignal}`);
  console.log(`- pendingRegime: ${regime.confirmedRegimeState.pendingRegime ?? "none"}`);
  console.log(`- pendingConfirmationDays: ${regime.confirmedRegimeState.pendingConfirmationDays}/${regime.confirmedRegimeState.requiredConfirmationDays}`);
  console.log(`- daysInConfirmedRegime: ${regime.confirmedRegimeState.daysInConfirmedRegime}`);
  console.log(`- confidence: ${regime.confirmedRegimeState.confidence}`);
  console.log(`- liquidityScore: ${regime.liquidityScore}`);
  console.log(`- inflationScore: ${regime.inflationScore}`);
  console.log(`- growthScore: ${regime.growthScore}`);
  console.log(`- riskAppetiteScore: ${regime.riskAppetiteScore}`);
  console.log(`- dollarScore: ${regime.dollarScore}`);
  console.log(`- creditScore: ${regime.creditScore}`);
  console.log(`- commodityScore: ${regime.commodityScore}`);
  console.log(`- chinaScore: ${regime.chinaScore}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
