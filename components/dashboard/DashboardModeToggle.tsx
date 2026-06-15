"use client";

import { useEffect, useState } from "react";

type DashboardMode = "simple" | "professional";

function applyMode(mode: DashboardMode) {
  document.documentElement.dataset.dashboardMode = mode;
}

export function DashboardModeToggle() {
  const [mode, setMode] = useState<DashboardMode>("professional");

  useEffect(() => {
    const savedMode = window.localStorage.getItem("dashboardMode");
    const nextMode: DashboardMode = savedMode === "simple" ? "simple" : "professional";
    setMode(nextMode);
    applyMode(nextMode);
  }, []);

  function updateMode(nextMode: DashboardMode) {
    setMode(nextMode);
    window.localStorage.setItem("dashboardMode", nextMode);
    applyMode(nextMode);
  }

  return (
    <div className="inline-flex rounded-md border border-white/10 bg-white/[0.03] p-0.5 text-xs">
      <button
        type="button"
        onClick={() => updateMode("simple")}
        className={`rounded px-2 py-1 transition ${mode === "simple" ? "bg-market-teal/15 text-market-teal" : "text-slate-400 hover:text-slate-200"}`}
      >
        簡易模式
      </button>
      <button
        type="button"
        onClick={() => updateMode("professional")}
        className={`rounded px-2 py-1 transition ${mode === "professional" ? "bg-market-teal/15 text-market-teal" : "text-slate-400 hover:text-slate-200"}`}
      >
        專業模式
      </button>
    </div>
  );
}
