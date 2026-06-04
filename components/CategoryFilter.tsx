import Link from "next/link";
import { categories } from "@/lib/indicatorCatalog";

export function CategoryFilter({ active }: { active?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/indicators"
        className={`rounded-md border px-3 py-1.5 text-sm ${!active ? "border-market-teal/60 bg-market-teal/10 text-market-teal" : "border-white/10 text-slate-400 hover:text-white"}`}
      >
        全部
      </Link>
      {categories.map((category) => (
        <Link
          key={category}
          href={`/indicators?category=${encodeURIComponent(category)}`}
          className={`rounded-md border px-3 py-1.5 text-sm ${active === category ? "border-market-teal/60 bg-market-teal/10 text-market-teal" : "border-white/10 text-slate-400 hover:text-white"}`}
        >
          {category}
        </Link>
      ))}
    </div>
  );
}
