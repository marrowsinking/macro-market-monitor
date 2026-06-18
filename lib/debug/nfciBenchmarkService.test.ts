import { describe, expect, test } from "vitest";
import {
  NFCI_BENCHMARK_SYMBOLS,
  compareScoreWithInvertedBenchmark,
  createNfciBenchmarkPayload,
} from "@/lib/debug/nfciBenchmarkService";

function weeklySeries(values: number[]) {
  return values.map((value, index) => ({
    date: `2026-01-${String(index + 1).padStart(2, "0")}`,
    value,
  }));
}

describe("nfciBenchmarkService", () => {
  test("defines the expected Chicago Fed NFCI benchmark symbols", () => {
    expect(NFCI_BENCHMARK_SYMBOLS).toEqual(["NFCI", "ANFCI", "NFCIRISK", "NFCICREDIT", "NFCILEVERAGE"]);
  });

  test("handles missing NFCI data without crashing", () => {
    const payload = createNfciBenchmarkPayload({
      benchmarkObservationsBySymbol: {},
      shadowScores: {},
      generatedAt: new Date("2026-06-18T00:00:00Z"),
    });

    expect(payload.benchmark.nfci.status).toBe("unavailable");
    expect(payload.alignment.liquidityVsNfci).toBe("unavailable");
    expect(payload.notes).toContain("NFCI benchmark data is unavailable. Run npm run fetch:fred after seeding NFCI indicators.");
  });

  test("liquidity positive aligns with negative NFCI", () => {
    expect(compareScoreWithInvertedBenchmark(1, -1)).toBe("aligned");
  });

  test("liquidity positive diverges from positive NFCI", () => {
    expect(compareScoreWithInvertedBenchmark(1, 1)).toBe("divergent");
  });

  test("credit positive aligns with negative NFCICREDIT", () => {
    const payload = createNfciBenchmarkPayload({
      benchmarkObservationsBySymbol: {
        NFCICREDIT: weeklySeries([0.2, 0.1, -0.8]),
      },
      shadowScores: {
        credit_score: 1,
      },
      generatedAt: new Date("2026-06-18T00:00:00Z"),
    });

    expect(payload.alignment.creditVsNfciCredit).toBe("aligned");
  });

  test("risk appetite positive aligns with negative NFCIRISK", () => {
    const payload = createNfciBenchmarkPayload({
      benchmarkObservationsBySymbol: {
        NFCIRISK: weeklySeries([0.2, 0.1, -0.7]),
      },
      shadowScores: {
        risk_appetite_score: 1,
      },
      generatedAt: new Date("2026-06-18T00:00:00Z"),
    });

    expect(payload.alignment.riskAppetiteVsNfciRisk).toBe("aligned");
  });

  test("neutral cases do not trigger false divergence", () => {
    expect(compareScoreWithInvertedBenchmark(0.1, -1)).toBe("unavailable");
    expect(compareScoreWithInvertedBenchmark(1, 0.1)).toBe("unavailable");
  });
});
