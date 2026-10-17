import { TZDate } from "@date-fns/tz";
import { differenceInBusinessDays, format, parseISO } from "date-fns";
import Link from "next/link";
import { BarList } from "@/components/charts/BarList";
import { StarsDisplay } from "@/components/feedback/Stars";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { theme } from "@/config/theme";
import { requireStaff } from "@/lib/auth";
import { manilaDayStart, todayInManila } from "@/lib/dates";
import { one } from "@/lib/feedback";
import { PENDING_TABS, STATUSES } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

// Manila calendar date of a timestamp, for counting working days.
const manilaDay = (ts: string) => parseISO(format(new TZDate(new Date(ts).getTime(), theme.timeZone), "yyyy-MM-dd"));

// §7.2 #4: "Marketing Design Pipeline <year> YTD". Counts cover requests
// filed this year; Pendings cover every open request.
export default async function DashboardPage() {
  await requireStaff();
  const supabase = await createClient();
  const year = todayInManila().slice(0, 4);
  const yearStart = manilaDayStart(`${year}-01-01`);

  const [{ data: requests, error }, { data: open }, { data: feedback }] = await Promise.all([
    supabase
      .from("requests")
      .select("status, created_at, date_completed, team:teams(name, is_marketing), request_type:request_types(name)")
      .gte("created_at", yearStart),
    supabase.from("requests").select("status").in("status", PENDING_TABS.map((t) => t.status)),
    supabase
      .from("feedback")
      .select("process_rating, output_rating, request:requests(team:teams(is_marketing))")
      .gte("submitted_at", yearStart),
  ]);
  if (error) throw new Error(error.message);
  const rows = requests ?? [];

  const countBy = (key: (r: (typeof rows)[number]) => string) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
    return m;
  };
  const byStatus = countBy((r) => r.status);
  const byTeam = countBy((r) => r.team?.name ?? "—");
  const byType = countBy((r) => r.request_type?.name ?? "—");
  const sorted = (m: Map<string, number>) =>
    [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  const pendingCounts = PENDING_TABS.map((t) => ({ ...t, count: (open ?? []).filter((r) => r.status === t.status).length }));
  const totalPending = pendingCounts.reduce((n, t) => n + t.count, 0);

  // Working days (Mon–Fri) from request date to date completed.
  const done = rows.filter((r) => r.status === "completed" && r.date_completed);
  const turnaround = done.length
    ? done.reduce((sum, r) => sum + Math.max(0, differenceInBusinessDays(manilaDay(r.date_completed!), manilaDay(r.created_at))), 0) /
      done.length
    : null;

  const counted = (feedback ?? []).filter((f) => !one(f.request)?.team?.is_marketing);
  const avg = (pick: (f: (typeof counted)[number]) => number) =>
    counted.length ? counted.reduce((s, f) => s + pick(f), 0) / counted.length : null;
  const processAvg = avg((f) => f.process_rating);
  const outputAvg = avg((f) => f.output_rating);
  const overall = processAvg !== null && outputAvg !== null ? (processAvg + outputAvg) / 2 : null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Marketing Design Pipeline {year} YTD</h1>
        <p className="text-muted-foreground">Requests filed this year, open work and feedback at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Requests this year" value={String(rows.length)} />
        <Stat title="Completed" value={String(byStatus.get("completed") ?? 0)} />
        <Stat
          title="Average turnaround"
          value={turnaround === null ? "—" : `${turnaround.toFixed(1)} days`}
          note="Working days, request date to completed"
        />
        <Stat title="Overall feedback" value={overall === null ? "—" : <StarsDisplay value={overall} size="md" />} note={`${counted.length} responses (Marketing team excluded)`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Requests by status</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList data={STATUSES.map((s) => ({ label: s.label, value: byStatus.get(s.value) ?? 0 }))} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pendings</CardTitle>
            <CardDescription>{totalPending} open requests</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {pendingCounts.map((t) => (
                <li key={t.status}>
                  <Link
                    href={`/admin/pendings?status=${t.status}`}
                    className="flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:border-brand hover:bg-brand-soft/50"
                  >
                    <span className="text-sm">{t.label}</span>
                    <span className="text-lg font-semibold">{t.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Requests per team</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList data={sorted(byTeam)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top types of request</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList data={sorted(byType)} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat title="Process average" value={processAvg === null ? "—" : <StarsDisplay value={processAvg} size="md" />} />
        <Stat title="Output average" value={outputAvg === null ? "—" : <StarsDisplay value={outputAvg} size="md" />} />
        <Stat title="Overall rating" value={overall === null ? "—" : <StarsDisplay value={overall} size="md" />} />
      </div>
    </div>
  );
}

function Stat({ title, value, note }: { title: string; value: React.ReactNode; note?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      {note && (
        <CardContent>
          <p className="text-xs text-muted-foreground">{note}</p>
        </CardContent>
      )}
    </Card>
  );
}
