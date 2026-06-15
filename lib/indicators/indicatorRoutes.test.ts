import { describe, expect, test } from "vitest";
import { indicatorDetailHref, parseIndicatorIdParam } from "@/lib/indicators/indicatorRoutes";

describe("indicator routes", () => {
  test("uses indicator id for symbols with special URL characters", () => {
    const symbols = ["^GSPC", "^NDX", "GC=F", "SI=F", "HG=F", "DX-Y.NYB", "JPY=X", "CNH=X"];

    symbols.forEach((symbol, index) => {
      const id = index + 1;
      const href = indicatorDetailHref({ id, symbol });

      expect(href).toBe(`/indicators/${id}`);
      expect(href).not.toContain(symbol);
    });
  });

  test("keeps range query on id-based detail routes", () => {
    expect(indicatorDetailHref({ id: 8 }, "5y")).toBe("/indicators/8?range=5y");
  });

  test("parses valid id params and rejects invalid params", () => {
    expect(parseIndicatorIdParam("12")).toBe(12);
    expect(parseIndicatorIdParam("^GSPC")).toBeNull();
    expect(parseIndicatorIdParam("GC=F")).toBeNull();
    expect(parseIndicatorIdParam("0")).toBeNull();
  });
});
