export function InsightPanel({ title, subtitle, items }: { title: string; subtitle: string; items: string[] }) {
  return (
    <div className="panel rounded-lg p-5">
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
      </div>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-sm leading-6 text-slate-300">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-market-teal" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
