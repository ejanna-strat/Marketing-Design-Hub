import Link from "next/link";

// href: optional page the row opens (e.g. that status's list).
export type BarDatum = { label: string; value: number; href?: string };

// Horizontal bars in one hue (magnitude). Full category names wrap instead of
// being shortened (owner, Oct 21); the value (and share) sits at the bar end.
export function BarList({
  data,
  unit = "requests",
  emptyText = "No data yet.",
  total,
}: {
  data: BarDatum[];
  unit?: string;
  emptyText?: string;
  // When given, each value also shows its share of this total, e.g. "12 (40%)".
  total?: number;
}) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }
  const max = Math.max(...data.map((d) => d.value));
  const pct = (v: number) => (total ? ` (${Math.round((v / total) * 100)}%)` : "");
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li
          key={d.label}
          className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]"
          title={`${d.label}: ${d.value} ${unit}${pct(d.value)}`}
        >
          {d.href ? (
            <Link href={d.href} className="text-right text-xs leading-snug text-brand hover:underline">
              {d.label}
            </Link>
          ) : (
            <span className="text-right text-xs leading-snug text-muted-foreground">{d.label}</span>
          )}
          <span className="flex items-center gap-2">
            {d.value > 0 && (
              <span className="h-[18px] rounded-r bg-brand" style={{ width: `${(d.value / max) * 75}%` }} aria-hidden />
            )}
            <span className="shrink-0 text-xs font-semibold whitespace-nowrap text-gray-700 dark:text-gray-300 tabular-nums">
              {d.value}
              {pct(d.value)}
              <span className="sr-only"> {unit}</span>
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
