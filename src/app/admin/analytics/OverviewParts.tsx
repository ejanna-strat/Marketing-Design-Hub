import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Analytics Overview pieces (owner's mock-up, Oct 23).


const STAND_COLORS = {
  Completed: "bg-emerald-600",
  Open: "bg-amber-500",
  "On hold": "bg-slate-400",
  "Waiting for a designer": "bg-sky-400",
} as const;

// Where the period's requests are now: one stacked bar and a legend.
export function WhereTheyStand({
  title,
  groups,
  note,
}: {
  title: string;
  // What the % is based on (owner, Oct 24).
  note?: string;
  groups: { label: keyof typeof STAND_COLORS; value: number; detail?: string }[];
}) {
  const total = groups.reduce((n, g) => n + g.value, 0);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {total === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No requests in this period.</p>
        ) : (
          <>
            <div className="flex h-7 overflow-hidden rounded-md" aria-hidden>
              {groups
                .filter((g) => g.value > 0)
                .map((g) => (
                  <span key={g.label} className={cn("h-full border-r-2 border-card last:border-r-0", STAND_COLORS[g.label])} style={{ width: `${(g.value / total) * 100}%` }} />
                ))}
            </div>
            <ul className="space-y-1.5 text-sm">
              {groups.map((g) => (
                <li key={g.label} className="flex items-center gap-2">
                  <span className={cn("size-3 shrink-0 rounded-sm", STAND_COLORS[g.label])} aria-hidden />
                  <span className="flex-1">
                    {g.label}
                    {g.detail && <span className="text-muted-foreground"> · {g.detail}</span>}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {g.value}
                    <span className="ml-1 font-normal text-muted-foreground">· {pct(g.value, total)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  );
}

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "—");

// Who asked (teams) or Request types: the biggest ones, with the rest folded
// into one line, each with its share of the period's requests.
export function WhoAsked({
  title,
  noun,
  items: teams,
  total,
  children,
}: {
  title: string;
  noun: string;
  items: { label: string; value: number }[];
  total: number;
  children?: React.ReactNode;
}) {
  const max = Math.max(1, ...teams.map((t) => t.value));
  // Teams with more than one request (up to 4) get their own bar.
  const shown = teams.filter((t) => t.value > 1).slice(0, 4);
  const rest = teams.slice(shown.length);
  const restTotal = rest.reduce((n, t) => n + t.value, 0);
  const rows = [
    ...shown,
    ...(rest.length === 1
      ? rest
      : rest.length > 1
        ? [{ label: `${rest.length} other ${noun}${rest.every((t) => t.value === 1) ? ", 1 each" : ""}`, value: restTotal }]
        : []),
  ];
  const width = Math.max(max, restTotal);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No requests in this period.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {rows.map((r) => (
              <li key={r.label} className="space-y-1">
                <div className="flex justify-between gap-3">
                  <span>{r.label}</span>
                  <span className="font-semibold tabular-nums">
                    {r.value}
                    <span className="ml-1 font-normal text-muted-foreground">· {pct(r.value, total)}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-brand" style={{ width: `${(r.value / width) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
