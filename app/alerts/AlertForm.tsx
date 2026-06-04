"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type IndicatorOption = {
  id: number;
  symbol: string;
  name: string;
};

export function AlertForm({ indicators }: { indicators: IndicatorOption[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setError(null);
    const response = await fetch("/api/alerts", {
      method: "POST",
      body: JSON.stringify({
        indicatorId: Number(formData.get("indicatorId")),
        operator: String(formData.get("operator")),
        threshold: Number(formData.get("threshold")),
        message: String(formData.get("message")),
        severity: String(formData.get("severity")),
      }),
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "建立警報失敗");
      return;
    }
    router.refresh();
  }

  return (
    <form action={submit} className="panel grid gap-3 rounded-lg p-5 md:grid-cols-[1.4fr_0.7fr_0.8fr_1.6fr_0.8fr_auto]">
      <select name="indicatorId" className="rounded-md border border-white/10 bg-ink-900 px-3 py-2 text-sm text-white">
        {indicators.map((indicator) => (
          <option key={indicator.id} value={indicator.id}>
            {indicator.symbol} · {indicator.name}
          </option>
        ))}
      </select>
      <select name="operator" className="rounded-md border border-white/10 bg-ink-900 px-3 py-2 text-sm text-white" defaultValue=">">
        <option value=">">&gt;</option>
        <option value=">=">&gt;=</option>
        <option value="<">&lt;</option>
        <option value="<=">&lt;=</option>
        <option value="=">=</option>
      </select>
      <input name="threshold" type="number" step="any" required placeholder="threshold" className="rounded-md border border-white/10 bg-ink-900 px-3 py-2 text-sm text-white" />
      <input name="message" required placeholder="警報訊息" className="rounded-md border border-white/10 bg-ink-900 px-3 py-2 text-sm text-white" />
      <select name="severity" className="rounded-md border border-white/10 bg-ink-900 px-3 py-2 text-sm text-white" defaultValue="medium">
        <option value="low">low</option>
        <option value="medium">medium</option>
        <option value="high">high</option>
      </select>
      <button className="rounded-md bg-market-teal px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-market-teal/90">建立</button>
      {error ? <div className="md:col-span-6 text-sm text-market-red">{error}</div> : null}
    </form>
  );
}
