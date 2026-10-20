import { TZDate } from "@date-fns/tz";
import { differenceInBusinessDays, format, parseISO } from "date-fns";
import Link from "next/link";
import { BarList } from "@/components/charts/BarList";
import { foldShares } from "@/components/charts/palette";
import { ShareDonut } from "@/components/charts/ShareDonut";
import { StarsDisplay } from "@/components/feedback/Stars";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { theme } from "@/config/theme";
import { requireStaff } from "@/lib/auth";
import { manilaDayStart, todayInManila } from "@/lib/dates";
import { one } from "@/lib/feedback";
import { formatPeso } from "@/lib/money";
import { INACTIVE_STATUSES, PENDING_TABS, STATUSES } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";

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
      .select("status, created_at, date_completed, is_deal, deal_size, team:teams(name, is_marketing), request_type:request_types(name)")
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

  const total = rows.length;
  const completed = byStatus.get("completed") ?? 0;
  const inactive = INACTIVE_STATUSES.reduce((n, st) => n + (byStatus.get(st) ?? 0), 0);
  const rate = (n: number, of = total) => (of ? `${Math.round((n / of) * 100)}%` : "—");
  // Feedback response rate: completed requests from outside the Marketing team.
  const completedOutside = rows.filter((r) => r.status === "completed" && !r.team?.is_marketing).length;
  const teams = foldShares(sorted(byTeam));
  const deals = rows.filter((r) => r.is_deal);
  const dealTotal = deals.reduce((n, r) => n + (r.deal_size ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Marketing Design Pipeline {year} YTD</h1>
        <p className="text-muted-foreground">Requests filed this year, open work and feedback at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Requests this year" value={String(total)} note={`${totalPending} still pending`} />
        <Stat
          title="Completed"
          value={
            <>
              {completed} <span className="text-base font-medium text-muted-foreground">· {rate(completed)}</span>
            </>
          }
          note="Completion rate, of this year's requests"
        />
        <Stat
          title="Inactive"
          value={
            <>
              {inactive} <span className="text-base font-medium text-muted-foreground">· {rate(inactive)}</span>
            </>
          }
          note="Cancelled and Returned, of this year's requests"
          href="/admin/inactive"
        />
        <Stat
          title="Average turnaround"
          value={turnaround === null ? "—" : `${turnaround.toFixed(1)} days`}
          note="Working days, request date to completed"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Link href="/admin/feedback" className="block rounded-xl transition-shadow hover:shadow-md">
          <Card className="h-full">
            <CardHeader>
              <CardDescription>Overall feedback</CardDescription>
              <CardTitle className="text-2xl">
                {overall === null ? "—" : <StarsDisplay value={overall} size="md" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Process average</dt>
                  <dd>{processAvg === null ? "—" : <StarsDisplay value={processAvg} />}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Output average</dt>
                  <dd>{outputAvg === null ? "—" : <StarsDisplay value={outputAvg} />}</dd>
                </div>
              </dl>
              <p className="text-sm">
                <span className="font-semibold">{counted.length}</span> of {completedOutside} completed requests have feedback
                {completedOutside > 0 && <span className="text-muted-foreground"> · {rate(counted.length, completedOutside)}</span>}
              </p>
              <p className="text-xs text-muted-foreground">Marketing team requesters excluded</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/deals" className="block rounded-xl transition-shadow hover:shadow-md">
          <Card className="h-full">
            <CardHeader>
              <CardDescription>Requests with Associated Deals this year</CardDescription>
              <CardTitle className="text-2xl">{deals.length}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-sm text-muted-foreground">Total deal size</p>
              <p className="text-xl font-semibold">{formatPeso(dealTotal)}</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Requests by status</CardTitle>
            <CardDescription>Share of this year&apos;s {total} requests</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              data={STATUSES.map((s) => ({ label: s.label, value: byStatus.get(s.value) ?? 0, href: statusPage(s.value) }))}
              total={total}
            />
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
            {teams.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                <ShareDonut data={teams} />
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 font-medium">Team</th>
                      <th className="py-2 text-right font-medium">Requests</th>
                      <th className="py-2 text-right font-medium">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((t) => (
                      <tr key={t.label} className="border-b last:border-0">
                        <td className="py-2">
                          <span className="flex items-center gap-2">
                            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                            {t.label}
                          </span>
                        </td>
                        <td className="py-2 text-right tabular-nums">{t.value}</td>
                        <td className="py-2 text-right tabular-nums">{rate(t.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 types of request</CardTitle>
            <CardDescription>Share of this year&apos;s {total} requests</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList data={sorted(byType).slice(0, 5)} total={total} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Where each status in "Requests by status" opens (owner, Oct 21): pending
// statuses → their Pendings tab, Completed / On hold → that pipeline view,
// Returned / Cancelled → Inactive Requests.
function statusPage(status: string) {
  if ((PENDING_TABS as { status: string }[]).some((t) => t.status === status)) return `/admin/pendings?status=${status}`;
  if (status === "completed") return "/admin/pipeline?view=completed";
  if (status === "on_hold") return "/admin/pipeline?view=on_hold";
  return `/admin/inactive?status=${status}`;
}

function Stat({ title, value, note, href }: { title: string; value: React.ReactNode; note?: string; href?: string }) {
  const card = (
    <Card className="h-full">
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
  return href ? (
    <Link href={href} className="block rounded-xl transition-shadow hover:shadow-md">
      {card}
    </Link>
  ) : (
    card
  );
}
