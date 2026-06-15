import { describe, expect, test } from "vitest";
import { calculateConfirmedRegime, type PreviousRegimeState } from "@/lib/engines/confirmedRegimeEngine";

function previous(overrides: Partial<PreviousRegimeState> = {}): PreviousRegimeState {
  return {
    confirmedRegime: "風險偏好模式",
    rawRegimeSignal: "風險偏好模式",
    pendingRegime: null,
    pendingConfirmationDays: 0,
    requiredConfirmationDays: 3,
    daysInConfirmedRegime: 4,
    confidence: "medium",
    ...overrides,
  };
}

describe("calculateConfirmedRegime", () => {
  test("uses raw signal as confirmed regime when previous state is missing", () => {
    const result = calculateConfirmedRegime({ latestRawRegimeSignal: "風險偏好模式" });

    expect(result.confirmedRegime).toBe("風險偏好模式");
    expect(result.pendingRegime).toBeNull();
    expect(result.pendingConfirmationDays).toBe(0);
    expect(result.daysInConfirmedRegime).toBe(1);
    expect(result.confidence).toBe("medium");
  });

  test("does not switch confirmed regime on one different raw signal day", () => {
    const result = calculateConfirmedRegime({
      latestRawRegimeSignal: "避險模式",
      previousRegimeState: previous(),
    });

    expect(result.confirmedRegime).toBe("風險偏好模式");
    expect(result.pendingRegime).toBe("避險模式");
    expect(result.pendingConfirmationDays).toBe(1);
    expect(result.regimeChanged).toBe(false);
  });

  test("does not switch confirmed regime on the second consecutive different raw signal day", () => {
    const result = calculateConfirmedRegime({
      latestRawRegimeSignal: "避險模式",
      previousRegimeState: previous({ pendingRegime: "避險模式", pendingConfirmationDays: 1 }),
    });

    expect(result.confirmedRegime).toBe("風險偏好模式");
    expect(result.pendingRegime).toBe("避險模式");
    expect(result.pendingConfirmationDays).toBe(2);
    expect(result.regimeChanged).toBe(false);
  });

  test("switches confirmed regime on the third consecutive different raw signal day", () => {
    const result = calculateConfirmedRegime({
      latestRawRegimeSignal: "避險模式",
      previousRegimeState: previous({ pendingRegime: "避險模式", pendingConfirmationDays: 2 }),
    });

    expect(result.confirmedRegime).toBe("避險模式");
    expect(result.pendingRegime).toBeNull();
    expect(result.pendingConfirmationDays).toBe(0);
    expect(result.daysInConfirmedRegime).toBe(1);
    expect(result.regimeChanged).toBe(true);
  });

  test("clears pending regime when raw signal returns to confirmed regime", () => {
    const result = calculateConfirmedRegime({
      latestRawRegimeSignal: "風險偏好模式",
      previousRegimeState: previous({ pendingRegime: "避險模式", pendingConfirmationDays: 2 }),
    });

    expect(result.confirmedRegime).toBe("風險偏好模式");
    expect(result.pendingRegime).toBeNull();
    expect(result.pendingConfirmationDays).toBe(0);
    expect(result.daysInConfirmedRegime).toBe(5);
  });

  test("resets pending confirmation days when pending regime changes", () => {
    const result = calculateConfirmedRegime({
      latestRawRegimeSignal: "再通脹交易",
      previousRegimeState: previous({ pendingRegime: "避險模式", pendingConfirmationDays: 2 }),
    });

    expect(result.confirmedRegime).toBe("風險偏好模式");
    expect(result.pendingRegime).toBe("再通脹交易");
    expect(result.pendingConfirmationDays).toBe(1);
  });
});
