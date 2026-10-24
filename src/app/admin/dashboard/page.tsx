import { TZDate } from "@date-fns/tz";
import { differenceInBusinessDays, format, parseISO } from "date-fns";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { BarList } from "@/components/charts/BarList";
import { foldShares } from "@/components/charts/palette";
import { ShareDonut } from "@/components/charts/ShareDonut";
import { FeedbackSummary } from "@/components/feedback/FeedbackSummary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { theme } from "@/config/theme";
import { requireStaff } from "@/lib/auth";
import { manilaDayStart, todayInManila } from "@/lib/dates";
import { one } from "@/lib/feedback";
import { formatPeso } from "@/lib/money";
import { INACTIVE_STATUSES, PENDING_TABS, STATUSES } from "@/lib/statuses";
import { MetricRows } from "@/components/MetricRows";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

// Manila calendar date of a timestamp, for counting working days.
const manilaDay = (ts: string) => parseISO(format(new TZDate(new Date(ts).getTime(), theme.timeZone), "yyyy-MM-dd"));

// §7.2 #4: "Marketing Design Pipeline <year> YTD". Counts cover requests
// filed this year; Pendings cover every open request.
// Reached Designer assigned or later (same as Analytics' "Accepted").
const ACCEPTED = new Set(["designer_assigned", "in_progress", "for_review", "for_revision", "completed"]);
// Accepted and still being worked on.
const OPEN_ACCEPTED = new Set(["designer_assigned", "in_progress", "for_review", "for_revision"]);
// Active requests by status: accepted work only, On hold after Completed
// (owner, Oct 24).
const ACTIVE_STATUS_ORDER = ["designer_assigned", "in_progress", "for_review", "for_revision", "completed", "on_hold"];

export default async function DashboardPage() {
  await requireStaff();
  const supabase = await createClient();
  const year = todayInManila().slice(0, 4);
  const yearStart = manilaDayStart(`${year}-01-01`);

  const [{ data: requests, error }, { data: open }, { data: feedback }, { data: acceptedLog }] = await Promise.all([
    supabase
      .from("requests")
      .select("id, status, created_at, date_completed, is_deal, deal_size, team:teams(name, is_marketing), request_type:request_types(name)")
      .gte("created_at", yearStart),
    supabase.from("requests").select("status").in("status", PENDING_TABS.map((t) => t.status)),
    supabase
      .from("feedback")
      .select("process_rating, output_rating, request:requests(team:teams(is_marketing))")
      .gte("submitted_at", yearStart),
    // This year's requests that ever reached Designer assigned or later, so
    // Accepted also counts ones later put on hold, returned or cancelled
    // (same rule as Analytics).
    supabase
      .from("activity_log")
      .select("request_id, request:requests!inner(created_at)")
      .eq("action", "status")
      .in("to_value", [...ACCEPTED])
      .gte("request.created_at", yearStart),
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
  // Top 5 types count active requests only: Returned and Cancelled are left
  // out (owner, Oct 23).
  const activeRows = rows.filter((r) => !(INACTIVE_STATUSES as readonly string[]).includes(r.status));
  const activeByType = new Map<string, number>();
  for (const r of activeRows) activeByType.set(r.request_type?.name ?? "—", (activeByType.get(r.request_type?.name ?? "—") ?? 0) + 1);
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
  const everAccepted = new Set((acceptedLog ?? []).map((l) => l.request_id));
  const accepted = rows.filter((r) => ACCEPTED.has(r.status) || everAccepted.has(r.id)).length;
  // Open = accepted work still in progress; New requests not yet accepted
  // show separately as "waiting for a designer" (owner, Oct 24).
  const openNow = rows.filter((r) => OPEN_ACCEPTED.has(r.status)).length;
  const waiting = rows.filter((r) => r.status === "new_request").length;
  const onHold = rows.filter((r) => r.status === "on_hold" && everAccepted.has(r.id)).length;
  const completed = byStatus.get("completed") ?? 0;
  const inactive = INACTIVE_STATUSES.reduce((n, st) => n + (byStatus.get(st) ?? 0), 0);
  const rate = (n: number, of = total) => (of ? `${Math.round((n / of) * 100)}%` : "—");
  // Feedback response rate: completed requests from outside the Marketing team.
  const completedOutside = rows.filter((r) => r.status === "completed" && !r.team?.is_marketing).length;
  const teams = foldShares(sorted(byTeam));
  // Returned and Cancelled deal requests don't count (owner, Oct 21).
  const deals = rows.filter((r) => r.is_deal && !(INACTIVE_STATUSES as readonly string[]).includes(r.status));
  const dealTotal = deals.reduce((n, r) => n + (r.deal_size ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Marketing Design Pipeline {year} YTD</h1>
        <p className="text-muted-foreground">Requests filed this year, open work and feedback at a glance.</p>
      </div>

      {/* Two labelled rows, like Analytics (owner, Oct 24): all requests
          (% of total), then accepted work (% of accepted). */}
      <MetricRows
        period={`${year} year to date`}
        rows={[
          {
            label: "All requests",
            basis: "% of total requests",
            tiles: [
              { label: "Total requests", value: total, note: "Filed this year", tone: "slate" },
              {
                label: "Waiting for a designer",
                value: waiting,
                rate: rate(waiting),
                note: "New, not yet accepted",
                tone: "sky",
                href: "/admin/pendings?status=new_request",
              },
              { label: "Accepted", value: accepted, rate: rate(accepted), note: "Accepted by a designer", tone: "blue" },
              { label: "Inactive", value: inactive, rate: rate(inactive), note: "Returned or cancelled", tone: "grey", href: "/admin/inactive" },
            ],
          },
          {
            label: "Accepted work",
            basis: "% of accepted requests",
            tiles: [
              { label: "Open", value: openNow, rate: rate(openNow, accepted), note: "Still being worked on", tone: "amber", href: "/admin/pendings" },
              { label: "Completed", value: completed, rate: rate(completed, accepted), note: "Done and turned over", tone: "green" },
              { label: "On hold", value: onHold, rate: rate(onHold, accepted), note: "Paused", tone: "orange", href: "/admin/pipeline?view=on_hold" },
              {
                label: "Average turnaround",
                value: turnaround === null ? "—" : `${turnaround.toFixed(1)} days`,
                note: "Working days, request to completed",
                tone: "violet",
              },
            ],
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Link href="/admin/feedback" className="block rounded-xl transition-shadow hover:shadow-md">
          <FeedbackSummary
            overall={overall}
            process={processAvg}
            output={outputAvg}
            responses={counted.length}
            completed={completedOutside}
          />
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
        {/* Pendings first: people read left to right (owner, Oct 21). */}
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
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-4 py-3 transition-colors",
                      // Categories with requests waiting stand out (owner, Oct 21).
                      t.count > 0
                        ? "border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-950 dark:text-amber-300 hover:border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20"
                        : "text-muted-foreground hover:border-brand hover:bg-brand-soft/50",
                    )}
                  >
                    <span className={cn("text-sm", t.count > 0 && "font-medium")}>{t.label}</span>
                    <span className="text-lg font-semibold">{t.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            {/* Accepted work only, % of accepted; New requests waiting for a
                designer in their own box (owner, Oct 24). */}
            <CardTitle>Active requests by status</CardTitle>
            <CardDescription>Where this year&apos;s accepted requests are now</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* New requests nobody has accepted yet, first and number-first so
                the count sits next to its label (owner, Oct 24). */}
            <Link
              href="/admin/pendings?status=new_request"
              className="flex items-center gap-3 rounded-lg bg-cyan-50 px-4 py-3 text-cyan-950 transition-shadow hover:shadow-md dark:bg-cyan-500/10 dark:text-cyan-100"
            >
              <span className="text-2xl font-bold tabular-nums">{waiting}</span>
              <span className="flex-1 text-sm">
                new request{waiting === 1 ? "" : "s"} waiting for a designer
                <span className="block text-xs opacity-75">Not yet accepted, so not in the bars below</span>
              </span>
              <ChevronRightIcon className="size-4 opacity-60" aria-hidden />
            </Link>
            <BarList
              data={ACTIVE_STATUS_ORDER.map((st) => ({
                label: STATUSES.find((x) => x.value === st)?.label ?? st,
                value: st === "on_hold" ? onHold : (byStatus.get(st) ?? 0),
                href: statusPage(st),
              }))}
              total={accepted}
            />
            <p className="text-xs text-muted-foreground">
              % = share of this year&apos;s {accepted} accepted requests
              {accepted - openNow - completed - onHold > 0 &&
                `; ${accepted - openNow - completed - onHold} of them were later returned or cancelled`}
              .
            </p>
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
            <p className="mt-3 text-xs text-muted-foreground">Rate = share of this year&apos;s {total} requests.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 types of request</CardTitle>
            {/* Active requests only (owner, Oct 23). */}
            <CardDescription>
              Share of this year&apos;s {activeRows.length} active requests (Returned and Cancelled not counted)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarList data={sorted(activeByType).slice(0, 5)} total={activeRows.length} />
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

