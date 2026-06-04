import { scoreTone } from "@/lib/format";

export function ScoreCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="panel rounded-lg p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-3 text-3xl font-semibold ${scoreTone(value)}`}>{value.toFixed(1)}</div>
      <div className="mt-2 text-xs leading-5 text-slate-400">{hint}</div>
    </div>
  );
}
