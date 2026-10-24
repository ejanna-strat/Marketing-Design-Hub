import { ChevronRightIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TONES } from "@/lib/tones";
import { cn } from "@/lib/utils";

// Analytics Overview pieces (owner's mock-up, Oct 23).


export type FlowTile = { label: string; value: number; note: string; tone: keyof typeof TONES };

// Request flow as tinted tiles with arrows between the steps. The last tile
// (Inactive) sits apart, without an arrow: it's not a step in the flow.
export function RequestFlow({ period, steps, aside }: { period: string; steps: FlowTile[]; aside?: FlowTile }) {
  const tile = (t: FlowTile) => (
    <div className={cn("min-w-0 flex-1 rounded-xl px-4 py-3", TONES[t.tone])}>
      <p className="text-sm font-medium">{t.label}</p>
      <p className="text-3xl font-bold tabular-nums">{t.value}</p>
      <p className="text-xs opacity-75">{t.note}</p>
    </div>
  );
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Request flow</CardTitle>
        <span className="text-sm text-muted-foreground">{period}</span>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
          {steps.map((t, i) => (
            <div key={t.label} className="flex min-w-0 flex-1 items-center gap-2">
              {tile(t)}
              {i < steps.length - 1 && <ChevronRightIcon className="hidden size-4 shrink-0 text-muted-foreground lg:block" aria-hidden />}
            </div>
          ))}
          {aside && <div className="flex min-w-0 flex-1 lg:ml-3 lg:border-l lg:pl-6">{tile(aside)}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

const STAND_COLORS = { Completed: "bg-emerald-600", Open: "bg-sky-600", "On hold": "bg-amber-500", "Returned or cancelled": "bg-slate-400" } as const;

// Where the period's requests are now: one stacked bar and a legend.
export function WhereTheyStand({
  title,
  groups,
}: {
  title: string;
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
