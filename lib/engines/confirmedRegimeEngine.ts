export type PreviousRegimeState = {
  confirmedRegime: string;
  rawRegimeSignal: string;
  pendingRegime: string | null;
  pendingConfirmationDays: number;
  requiredConfirmationDays: number;
  daysInConfirmedRegime: number;
  confidence: string;
};

export type ConfirmedRegimeResult = {
  confirmedRegime: string;
  rawRegimeSignal: string;
  previousConfirmedRegime: string | null;
  regimeChanged: boolean;
  pendingRegime: string | null;
  pendingConfirmationDays: number;
  requiredConfirmationDays: number;
  daysInConfirmedRegime: number;
  confidence: "high" | "medium" | "low";
  explanation: string;
};

const defaultRequiredConfirmationDays = 3;

function confidenceForConfirmedDays(days: number): ConfirmedRegimeResult["confidence"] {
  if (days >= 5) return "high";
  if (days >= 2) return "medium";
  return "low";
}

export function calculateConfirmedRegime(input: {
  latestRawRegimeSignal: string;
  previousRegimeState?: PreviousRegimeState | null;
  requiredConfirmationDays?: number;
}): ConfirmedRegimeResult {
  const requiredConfirmationDays = input.requiredConfirmationDays ?? input.previousRegimeState?.requiredConfirmationDays ?? defaultRequiredConfirmationDays;
  const rawRegimeSignal = input.latestRawRegimeSignal;
  const previous = input.previousRegimeState ?? null;

  if (!previous) {
    return {
      confirmedRegime: rawRegimeSignal,
      rawRegimeSignal,
      previousConfirmedRegime: null,
      regimeChanged: false,
      pendingRegime: null,
      pendingConfirmationDays: 0,
      requiredConfirmationDays,
      daysInConfirmedRegime: 1,
      confidence: "medium",
      explanation: `首次建立 RegimeState，已確認宏觀狀態設為「${rawRegimeSignal}」。`,
    };
  }

  if (rawRegimeSignal === previous.confirmedRegime) {
    const daysInConfirmedRegime = previous.daysInConfirmedRegime + 1;
    return {
      confirmedRegime: previous.confirmedRegime,
      rawRegimeSignal,
      previousConfirmedRegime: previous.confirmedRegime,
      regimeChanged: false,
      pendingRegime: null,
      pendingConfirmationDays: 0,
      requiredConfirmationDays,
      daysInConfirmedRegime,
      confidence: confidenceForConfirmedDays(daysInConfirmedRegime),
      explanation: `今日信號與已確認狀態「${previous.confirmedRegime}」一致，暫無新的 regime 切換信號。`,
    };
  }

  const pendingRegime = rawRegimeSignal;
  const pendingConfirmationDays = previous.pendingRegime === rawRegimeSignal ? previous.pendingConfirmationDays + 1 : 1;

  if (pendingConfirmationDays >= requiredConfirmationDays) {
    return {
      confirmedRegime: pendingRegime,
      rawRegimeSignal,
      previousConfirmedRegime: previous.confirmedRegime,
      regimeChanged: true,
      pendingRegime: null,
      pendingConfirmationDays: 0,
      requiredConfirmationDays,
      daysInConfirmedRegime: 1,
      // A newly switched confirmed regime is already backed by the required consecutive raw signals, so it starts at medium confidence despite day count being 1.
      confidence: "medium",
      explanation: `raw signal 已連續 ${requiredConfirmationDays} 天指向「${pendingRegime}」，已確認 regime 從「${previous.confirmedRegime}」轉為「${pendingRegime}」。`,
    };
  }

  return {
    confirmedRegime: previous.confirmedRegime,
    rawRegimeSignal,
    previousConfirmedRegime: previous.confirmedRegime,
    regimeChanged: false,
    pendingRegime,
    pendingConfirmationDays,
    requiredConfirmationDays,
    daysInConfirmedRegime: previous.daysInConfirmedRegime,
    confidence: "low",
    explanation: `今日信號指向「${rawRegimeSignal}」，但正式 regime 仍維持「${previous.confirmedRegime}」，目前確認中 ${pendingConfirmationDays} / ${requiredConfirmationDays}。`,
  };
}
