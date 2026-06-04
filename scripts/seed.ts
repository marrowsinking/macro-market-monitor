import { loadEnvConfig } from "@next/env";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";
import { indicatorCatalog } from "../lib/indicatorCatalog";
import { yahooAssets } from "../lib/yahoo";

loadEnvConfig(process.cwd());

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const item of indicatorCatalog) {
    await prisma.indicator.upsert({
      where: { symbol: item.symbol },
      update: item,
      create: item,
    });
  }

  for (const item of yahooAssets) {
    await prisma.indicator.upsert({
      where: { symbol: item.symbol },
      update: {
        name: item.name,
        category: item.category,
        source: "YAHOO",
        fredSeriesId: null,
        frequency: "daily",
        description: item.description,
        macroLogic: item.macroLogic,
      },
      create: {
        name: item.name,
        symbol: item.symbol,
        category: item.category,
        source: "YAHOO",
        fredSeriesId: null,
        frequency: "daily",
        description: item.description,
        macroLogic: item.macroLogic,
      },
    });
  }

  const alertTemplates = [
    { symbol: "DXY", operator: ">", threshold: 105, message: "DXY > 105，美元壓力升高", severity: "high" },
    { symbol: "GOLD_SILVER_RATIO", operator: ">", threshold: 90, message: "Gold/Silver Ratio > 90，偏避險或工業需求偏弱", severity: "medium" },
    { symbol: "VIXCLS", operator: ">", threshold: 25, message: "VIX > 25，避險需求升高", severity: "high" },
    { symbol: "DGS10", operator: ">", threshold: 5, message: "10Y Yield > 5%，長端利率壓力升高", severity: "high" },
    { symbol: "T10Y2Y", operator: ">", threshold: 0, message: "2Y-10Y Spread 重新轉正", severity: "medium" },
    { symbol: "BAMLH0A0HYM2", operator: ">", threshold: 5, message: "High Yield Spread 快速擴大", severity: "high" },
    { symbol: "USDCNH", operator: ">", threshold: 7.35, message: "USDCNH 突破指定值，人民幣壓力升高", severity: "medium" },
  ];

  for (const template of alertTemplates) {
    const indicator = await prisma.indicator.findUnique({ where: { symbol: template.symbol } });
    if (!indicator) continue;
    const existing = await prisma.alert.findFirst({
      where: {
        indicatorId: indicator.id,
        operator: template.operator,
        threshold: template.threshold,
      },
    });
    if (!existing) {
      await prisma.alert.create({
        data: {
          indicatorId: indicator.id,
          operator: template.operator,
          threshold: template.threshold,
          message: template.message,
          severity: template.severity,
        },
      });
    }
  }

  console.log(`Seeded ${indicatorCatalog.length} base indicators and ${yahooAssets.length} Yahoo indicators.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
