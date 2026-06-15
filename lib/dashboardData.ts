import { subYears } from "date-fns";
import { calculateAllIndicatorStats } from "@/lib/calculateIndicators";
import { prisma } from "@/lib/prisma";

export async function getIndicatorStats() {
  const indicators = await prisma.indicator.findMany({
    include: {
      observations: {
        orderBy: { date: "desc" },
        take: 420,
      },
    },
    orderBy: [{ category: "asc" }, { symbol: "asc" }],
  });

  return calculateAllIndicatorStats(indicators);
}

export async function getDashboardData() {
  const [stats, latestMacroRegime, latestAlerts] = await Promise.all([
    getIndicatorStats(),
    prisma.macroRegime.findFirst({
      orderBy: { date: "desc" },
    }),
    prisma.alert.findMany({
      where: {
        triggeredAt: { not: null },
        severity: { in: ["high", "medium"] },
      },
      include: { indicator: true },
      orderBy: { triggeredAt: "desc" },
      take: 3,
    }),
  ]);
  const fredKeyMissing = !process.env.FRED_API_KEY?.trim();

  return {
    stats,
    regime: latestMacroRegime,
    latestAlerts,
    fredKeyMissing,
  };
}

export async function getIndicatorDetail(id: number, years: number) {
  const indicator = await prisma.indicator.findUnique({
    where: { id },
    include: {
      observations: {
        where: { date: { gte: subYears(new Date(), years) } },
        orderBy: { date: "asc" },
      },
    },
  });

  if (!indicator) return null;
  return {
    indicator,
    stat: calculateAllIndicatorStats([indicator])[0],
  };
}
