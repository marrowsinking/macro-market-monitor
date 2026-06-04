"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

type UpdateResult = {
  fred: {
    success: number;
    failed: number;
    observationsInserted: number;
  };
  yahoo: {
    success: number;
    failed: number;
    observationsInserted: number;
  };
  finalRegime: string;
  alerts: {
    triggered: number;
    inserted: number;
  };
};

type UpdateResponse =
  | ({ ok: true } & UpdateResult)
  | {
      ok: false;
      error: string;
    };

export function UpdateDataButton() {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const [result, setResult] = useState<UpdateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpdate() {
    setIsUpdating(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/update-data", {
        method: "POST",
      });
      const data = (await response.json()) as UpdateResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.ok ? "更新失敗" : data.error);
      }

      setResult({
        fred: data.fred,
        yahoo: data.yahoo,
        finalRegime: data.finalRegime,
        alerts: data.alerts,
      });
      startRefresh(() => {
        router.refresh();
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsUpdating(false);
    }
  }

  const disabled = isUpdating || isRefreshing;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleUpdate}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-md border border-market-teal/40 bg-market-teal/10 px-3 py-2 text-sm font-medium text-market-teal hover:border-market-teal/70 hover:bg-market-teal/15 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw size={15} className={disabled ? "animate-spin" : ""} />
        {disabled ? "更新中..." : "更新數據"}
      </button>

      {result ? (
        <div className="rounded-md border border-market-green/20 bg-market-green/8 p-3 text-xs leading-6 text-market-green">
          <div>更新完成：FRED 成功 {result.fred.success} / 失敗 {result.fred.failed}，Yahoo 成功 {result.yahoo.success} / 失敗 {result.yahoo.failed}。</div>
          <div>Final Regime：{result.finalRegime}；Alerts 觸發 {result.alerts.triggered} 條，新增 {result.alerts.inserted} 條。</div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-market-red/25 bg-market-red/10 p-3 text-xs leading-6 text-market-red">
          更新失敗：{error}
        </div>
      ) : null}
    </div>
  );
}
