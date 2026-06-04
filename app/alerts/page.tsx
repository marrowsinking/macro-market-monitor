import { AlertForm } from "@/app/alerts/AlertForm";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function AlertsPage() {
  const [alerts, indicators] = await Promise.all([
    prisma.alert.findMany({ include: { indicator: true }, orderBy: { createdAt: "desc" } }),
    prisma.indicator.findMany({ orderBy: [{ category: "asc" }, { symbol: "asc" }] }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Alerts 警報</h1>
        <p className="mt-2 text-sm text-slate-500">第一版只在頁面顯示觸發狀態，不發送通知。</p>
      </div>

      <AlertForm indicators={indicators.map((item) => ({ id: item.id, symbol: item.symbol, name: item.name }))} />

      <div className="panel overflow-hidden rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-white/[0.03] text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3">狀態</th>
                <th className="px-4 py-3">Alert 名稱</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Triggered At</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Related Indicator</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.id} className="border-t border-white/10">
                  <td className="px-4 py-3">
                    <span className={`rounded-md px-2 py-1 text-xs ${alert.triggeredAt ? "bg-market-red/15 text-market-red" : "bg-white/5 text-slate-400"}`}>
                      {alert.triggeredAt ? "已觸發" : "未觸發"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-white">{alert.message.split("，")[0]}</td>
                  <td className="px-4 py-3 text-slate-400">{alert.severity}</td>
                  <td className="px-4 py-3 text-slate-400">{alert.triggeredAt ? formatDateTime(alert.triggeredAt) : "未觸發"}</td>
                  <td className="px-4 py-3 text-slate-300">{alert.message}</td>
                  <td className="px-4 py-3 text-slate-300">{alert.indicator.symbol}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
