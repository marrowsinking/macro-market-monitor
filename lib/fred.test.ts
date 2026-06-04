import { describe, expect, test } from "vitest";
import { normalizeFredObservations } from "@/lib/fred";

describe("normalizeFredObservations", () => {
  test("skips missing and non-numeric values", () => {
    expect(
      normalizeFredObservations([
        { date: "2026-01-01", value: "." },
        { date: "2026-01-02", value: null },
        { date: "2026-01-03", value: "" },
        { date: "2026-01-04", value: "not-a-number" },
        { date: "2026-01-05", value: "4.25" },
      ]),
    ).toEqual([{ date: "2026-01-05", value: 4.25 }]);
  });
});
