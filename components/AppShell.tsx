import Link from "next/link";
import { BarChart3, Bell, BookOpenText, Gauge, ListFilter, Settings } from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/indicators", label: "Indicators", icon: ListFilter },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/methodology", label: "Methodology / 方法論", icon: BookOpenText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <aside className="fixed left-0 top-0 hidden h-screen w-64 border-r border-white/10 bg-ink-950/95 px-4 py-5 lg:block">
        <Link href="/" className="mb-8 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-market-teal/15 text-market-teal">
            <BarChart3 size={20} />
          </span>
          <span>
            <span className="block text-sm font-semibold text-white">macro-market-monitor</span>
            <span className="block text-xs text-slate-500">Macro Regime Desk</span>
          </span>
        </Link>
        <nav className="space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                <Icon size={17} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-ink-950/80 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2 text-sm font-semibold lg:hidden">
              <BarChart3 size={18} className="text-market-teal" />
              macro-market-monitor
            </Link>
            <div className="hidden text-sm text-slate-400 lg:block">每日宏觀狀態判斷器</div>
            <div className="mono text-xs text-slate-500">local SQLite · FRED MVP</div>
          </div>
        </header>
        <div className="px-4 py-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
