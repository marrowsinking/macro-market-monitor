"use client";

import { useState } from "react";

type Values = {
  FRED_API_KEY: string;
  FMP_API_KEY: string;
  NASDAQ_DATA_LINK_API_KEY: string;
  TRADING_ECONOMICS_API_KEY: string;
};

const labels: Record<keyof Values, string> = {
  FRED_API_KEY: "FRED API Key",
  FMP_API_KEY: "FMP API Key",
  NASDAQ_DATA_LINK_API_KEY: "Nasdaq Data Link API Key",
  TRADING_ECONOMICS_API_KEY: "Trading Economics API Key",
};

export function SettingsForm({ initialValues, disabled }: { initialValues: Values; disabled: boolean }) {
  const [values, setValues] = useState(initialValues);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json()) as { error?: string; message?: string };
    setMessage(payload.error ?? payload.message ?? "已保存");
  }

  return (
    <form onSubmit={submit} className="panel max-w-3xl space-y-4 rounded-lg p-5">
      {(Object.keys(labels) as Array<keyof Values>).map((key) => (
        <label key={key} className="block">
          <span className="text-sm text-slate-400">{labels[key]}</span>
          <input
            type="password"
            value={values[key]}
            disabled={disabled}
            onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
            className="mt-2 w-full rounded-md border border-white/10 bg-ink-900 px-3 py-2 text-sm text-white outline-none focus:border-market-teal/60"
            placeholder="只保存在本地 .env.local"
          />
        </label>
      ))}
      <div className="flex items-center gap-3">
        <button disabled={disabled} className="rounded-md bg-market-teal px-4 py-2 text-sm font-semibold text-ink-950 disabled:cursor-not-allowed disabled:opacity-50">
          保存到 .env.local
        </button>
        {message ? <span className="text-sm text-slate-400">{message}</span> : null}
      </div>
    </form>
  );
}
