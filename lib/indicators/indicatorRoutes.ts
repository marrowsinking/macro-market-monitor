export function indicatorDetailHref(indicator: { id: number; symbol?: string }, range?: string): string {
  const base = `/indicators/${indicator.id}`;
  return range ? `${base}?range=${encodeURIComponent(range)}` : base;
}

export function parseIndicatorIdParam(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
