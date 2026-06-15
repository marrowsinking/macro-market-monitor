import Link from "next/link";
import { categories } from "@/lib/indicatorCatalog";

function hrefFor(category: string, params?: Record<string, string>) {
  const next = new URLSearchParams(params);
  if (category === "all") {
    next.delete("category");
  } else {
    next.set("category", category);
  }
  const query = next.toString();
  return query ? `/indicators?${query}` : "/indicators";
}

export function CategoryFilter({ active, params }: { active?: string; params?: Record<string, string> }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={hrefFor("all", params)}
        className={`rounded-md border px-3 py-1.5 text-sm ${!active || active === "all" ? "border-market-teal/60 bg-market-teal/10 text-market-teal" : "border-white/10 text-slate-400 hover:text-white"}`}
      >
        全部
      </Link>
      {categories.map((category) => (
        <Link
          key={category}
          href={hrefFor(category, params)}
          className={`rounded-md border px-3 py-1.5 text-sm ${active === category ? "border-market-teal/60 bg-market-teal/10 text-market-teal" : "border-white/10 text-slate-400 hover:text-white"}`}
        >
          {category}
        </Link>
      ))}
    </div>
  );
}
