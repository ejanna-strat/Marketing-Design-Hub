import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TONES, type Tone } from "@/lib/tones";
import { cn } from "@/lib/utils";

export type MetricTile = {
  label: string;
  value: React.ReactNode;
  // "72%": shown small beside the value.
  rate?: string;
  note: string;
  tone: Tone;
  href?: string;
};

// The request numbers in two labelled rows (owner, Oct 24), on the Dashboard
// and Analytics: all requests (rates of total requests), then accepted work
// (rates of accepted requests), so each % has an obvious basis.
export function MetricRows({
  period,
  rows,
}: {
  period: string;
  rows: { label: string; basis: string; tiles: MetricTile[] }[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Request flow</CardTitle>
        <span className="text-sm text-muted-foreground">{period}</span>
      </CardHeader>
      <CardContent className="space-y-5">
        {rows.map((row) => (
          <div key={row.label} className="space-y-2">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {row.label} <span className="font-normal tracking-normal normal-case">· {row.basis}</span>
            </p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {row.tiles.map((t) => {
                const body = (
                  <div className={cn("h-full rounded-xl px-4 py-3", TONES[t.tone], t.href && "transition-shadow hover:shadow-md")}>
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-3xl font-bold tabular-nums">
                      {t.value}
                      {t.rate && <span className="ml-1.5 text-base font-medium opacity-70">· {t.rate}</span>}
                    </p>
                    <p className="text-xs opacity-75">{t.note}</p>
                  </div>
                );
                return t.href ? (
                  <Link key={t.label} href={t.href} className="block rounded-xl">
                    {body}
                  </Link>
                ) : (
                  <div key={t.label}>{body}</div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
