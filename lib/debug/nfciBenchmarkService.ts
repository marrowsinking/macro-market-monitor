export const NFCI_BENCHMARK_SYMBOLS = ["NFCI", "ANFCI", "NFCIRISK", "NFCICREDIT", "NFCILEVERAGE"] as const;

export type NfciBenchmarkSymbol = (typeof NFCI_BENCHMARK_SYMBOLS)[number];
export type NfciAlignment = "aligned" | "divergent" | "unavailable";

export type NfciObservationPoint = {
  date: Date | string;
  value: number;
};

export type NfciBenchmarkPoint = {
  symbol: NfciBenchmarkSymbol;
  name: string;
  latestValue: number | null;
  zScore: number | null;
  latestDate: string | null;
  status: "ok" | "unavailable";
  message: string | null;
};

export type NfciBenchmarkPayload = {
  generatedAt: string;
  engineVersion: "nfci-benchmark-debug";
  benchmark: {
    nfci: NfciBenchmarkPoint;
    anfci: NfciBenchmarkPoint;
    risk: NfciBenchmarkPoint;
    credit: NfciBenchmarkPoint;
    leverage: NfciBenchmarkPoint;
  };
  shadowScores: {
    liquidity_score: number | null;
    credit_score: number | null;
    risk_appetite_score: number | null;
  };
  alignment: {
    liquidityVsNfci: NfciAlignment;
    creditVsNfciCredit: NfciAlignment;
    riskAppetiteVsNfciRisk: NfciAlignment;
  };
  notes: string[];
};

const NEUTRAL_THRESHOLD = 0.25;

const benchmarkNames: Record<NfciBenchmarkSymbol, string> = {
  NFCI: "Chicago Fed National Financial Conditions Index",
  ANFCI: "Chicago Fed Adjusted National Financial Conditions Index",
  NFCIRISK: "Chicago Fed NFCI Risk Subindex",
  NFCICREDIT: "Chicago Fed NFCI Credit Subindex",
  NFCILEVERAGE: "Chicago Fed NFCI Leverage Subindex",
};

function dateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function validSeries(points: NfciObservationPoint[] | undefined): Array<{ date: string; value: number }> {
  return (points ?? [])
    .flatMap((point) => {
      if (!Number.isFinite(point.value)) return [];
      const date = point.date instanceof Date ? point.date : new Date(point.date);
      if (!Number.isFinite(date.getTime())) return [];
      return [{ date: dateKey(date), value: point.value }];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function calculateZScore(values: number[]): number | null {
  if (values.length < 2) return null;
  const latest = values[values.length - 1];
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  if (std === 0) return null;
  return (latest - mean) / std;
}

function benchmarkPoint(symbol: NfciBenchmarkSymbol, points: NfciObservationPoint[] | undefined): NfciBenchmarkPoint {
  const series = validSeries(points);
  if (series.length === 0) {
    return {
      symbol,
      name: benchmarkNames[symbol],
      latestValue: null,
      zScore: null,
      latestDate: null,
      status: "unavailable",
      message: `${symbol} benchmark observations are unavailable.`,
    };
  }

  return {
    symbol,
    name: benchmarkNames[symbol],
    latestValue: series[series.length - 1].value,
    zScore: calculateZScore(series.map((point) => point.value)),
    latestDate: series[series.length - 1].date,
    status: "ok",
    message: null,
  };
}

function signBucket(value: number | null | undefined): "positive" | "negative" | "neutral" | "unavailable" {
  if (value === null || value === undefined || !Number.isFinite(value)) return "unavailable";
  if (value > NEUTRAL_THRESHOLD) return "positive";
  if (value < -NEUTRAL_THRESHOLD) return "negative";
  return "neutral";
}

export function compareScoreWithInvertedBenchmark(scoreValue: number | null | undefined, benchmarkValue: number | null | undefined): NfciAlignment {
  const score = signBucket(scoreValue);
  const benchmark = signBucket(benchmarkValue);
  if (score === "unavailable" || benchmark === "unavailable" || score === "neutral" || benchmark === "neutral") return "unavailable";
  return score !== benchmark ? "aligned" : "divergent";
}

export function createNfciBenchmarkPayload(input: {
  benchmarkObservationsBySymbol: Partial<Record<NfciBenchmarkSymbol, NfciObservationPoint[]>>;
  shadowScores: Partial<Record<"liquidity_score" | "credit_score" | "risk_appetite_score", number | null>>;
  generatedAt?: Date;
}): NfciBenchmarkPayload {
  const benchmark = {
    nfci: benchmarkPoint("NFCI", input.benchmarkObservationsBySymbol.NFCI),
    anfci: benchmarkPoint("ANFCI", input.benchmarkObservationsBySymbol.ANFCI),
    risk: benchmarkPoint("NFCIRISK", input.benchmarkObservationsBySymbol.NFCIRISK),
    credit: benchmarkPoint("NFCICREDIT", input.benchmarkObservationsBySymbol.NFCICREDIT),
    leverage: benchmarkPoint("NFCILEVERAGE", input.benchmarkObservationsBySymbol.NFCILEVERAGE),
  };
  const shadowScores = {
    liquidity_score: input.shadowScores.liquidity_score ?? null,
    credit_score: input.shadowScores.credit_score ?? null,
    risk_appetite_score: input.shadowScores.risk_appetite_score ?? null,
  };
  const notes = [
    "NFCI positive means financial conditions are tighter than average.",
    "Liquidity, credit, and risk appetite scores are interpreted in the opposite direction: positive score means easier or healthier conditions.",
    "Use liquidity_score vs -NFCI, credit_score vs -NFCICREDIT, and risk_appetite_score vs -NFCIRISK.",
  ];

  if (Object.values(benchmark).some((item) => item.status === "unavailable")) {
    notes.push("NFCI benchmark data is unavailable. Run npm run fetch:fred after seeding NFCI indicators.");
  }

  return {
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    engineVersion: "nfci-benchmark-debug",
    benchmark,
    shadowScores,
    alignment: {
      liquidityVsNfci: compareScoreWithInvertedBenchmark(shadowScores.liquidity_score, benchmark.nfci.latestValue),
      creditVsNfciCredit: compareScoreWithInvertedBenchmark(shadowScores.credit_score, benchmark.credit.latestValue),
      riskAppetiteVsNfciRisk: compareScoreWithInvertedBenchmark(shadowScores.risk_appetite_score, benchmark.risk.latestValue),
    },
    notes,
  };
}
