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
  alertsCount: number;
};

type UpdateResponse =
  | ({ success: true } & UpdateResult)
  | {
      success: false;
      error: string;
    };

async function readUpdateResponse(response: Response): Promise<UpdateResponse> {
  try {
    return (await response.json()) as UpdateResponse;
  } catch {
    return {
      success: false,
      error: "更新服務沒有返回有效 JSON。",
    };
  }
}

export function UpdateDataButton({ compact = false }: { compact?: boolean }) {
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
      const data = await readUpdateResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(data.success ? "更新失敗" : data.error);
      }

      setResult({
        fred: data.fred,
        yahoo: data.yahoo,
        finalRegime: data.finalRegime,
        alertsCount: data.alertsCount,
      });
      startRefresh(() => {
        router.refresh();
      });
    } catch (caught) {
      if (caught instanceof TypeError && caught.message === "Failed to fetch") {
        setError("無法連接更新服務，請確認 dev server 是否正在運行，並檢查目前使用的 port。");
      } else {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    } finally {
      setIsUpdating(false);
    }
  }

  const disabled = isUpdating || isRefreshing;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleUpdate}
        disabled={disabled}
        className={`inline-flex items-center gap-2 rounded-md border border-market-teal/40 bg-market-teal/10 font-medium text-market-teal hover:border-market-teal/70 hover:bg-market-teal/15 disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"
        }`}
      >
        <RefreshCw size={compact ? 13 : 15} className={disabled ? "animate-spin" : ""} />
        {disabled ? "更新中..." : compact ? "更新" : "更新數據"}
      </button>

      {result ? (
        <div className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs leading-5 text-emerald-300">
          更新完成：FRED {result.fred.success}/{result.fred.success + result.fred.failed}，YAHOO {result.yahoo.success}/{result.yahoo.success + result.yahoo.failed}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md bg-red-500/10 px-2 py-1 text-xs leading-5 text-red-300">
          更新失敗：{error}
        </div>
      ) : null}
    </div>
  );
}
