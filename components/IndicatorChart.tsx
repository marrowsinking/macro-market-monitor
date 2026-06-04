"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = {
  date: string;
  value: number;
};

export function IndicatorChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return <div className="flex h-80 items-center justify-center text-sm text-slate-500">暫無歷史數據</div>;
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 8, right: 16, top: 20, bottom: 8 }}>
          <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
          <XAxis dataKey="date" stroke="#64748b" tickLine={false} axisLine={false} minTickGap={32} />
          <YAxis stroke="#64748b" tickLine={false} axisLine={false} width={64} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{
              background: "#0d1317",
              border: "1px solid rgba(148, 163, 184, 0.18)",
              borderRadius: 8,
              color: "#eef4f6",
            }}
            labelStyle={{ color: "#94a3b8" }}
          />
          <Line type="monotone" dataKey="value" stroke="#18d4c0" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
