import {
  ArchiveIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  BarChart3Icon,
  BriefcaseBusinessIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  UsersIcon,
} from "lucide-react";
import { BarList } from "@/components/charts/BarList";
import { MonthBars } from "@/components/charts/MonthBars";
import { foldShares, type Share } from "@/components/charts/palette";
import { ShareDonut } from "@/components/charts/ShareDonut";
import { StarsDisplay } from "@/components/feedback/Stars";
import { SummaryBox, shareOf } from "@/components/SummaryBox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { endOfMonth, format, parseISO, subMonths } from "date-fns";
import { type Analytics, firstRequestDay, loadAnalytics } from "@/lib/analytics";
import { formatDate, todayInManila } from "@/lib/dates";
import { requireStaff } from "@/lib/auth";
import { formatPeso } from "@/lib/money";
import { STATUSES } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";
import { PeriodControls } from "./PeriodControls";

const days = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)} days`);
const stars = (v: number | null) => (v === null ? "—" : v.toFixed(1));
const th = "px-3 py-2 text-right font-medium whitespace-nowrap";
const td = "px-3 py-2 text-right tabular-nums whitespace-nowrap";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

// Analytics / Reports (§7.2 #6, pulled forward Oct 21). Two tabs (owner,
// Oct 21): Monthly report (a month, or a custom range; opens on last month)
// and Month on Month (a full year; opens on this year). Same reports on both;
// only Month on Month has the month-by-month charts, table and columns.
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const param = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const supabase = await createClient();
  const today = todayInManila();
  const first = (await firstRequestDay(supabase)) ?? today;
  const tab = param("tab") === "mom" ? "mom" : "monthly";

  // Months from the first request to this month (newest first), and years.
  const monthOptions: { value: string; label: string }[] = [];
  for (let m = parseISO(`${today.slice(0, 7)}-01`); format(m, "yyyy-MM") >= first.slice(0, 7); m = subMonths(m, 1)) {
    monthOptions.push({ value: format(m, "yyyy-MM"), label: format(m, "MMMM yyyy") });
  }
  const years: string[] = [];
  for (let y = Number(today.slice(0, 4)); y >= Number(first.slice(0, 4)); y--) years.push(String(y));

  let from: string;
  let to: string;
  let month: string | null = null;
  let year = today.slice(0, 4);
  let periodLabel: string;
  if (tab === "mom") {
    if (years.includes(param("year"))) year = param("year");
    from = `${year}-01-01`;
    to = year === today.slice(0, 4) ? today : `${year}-12-31`;
    periodLabel = `${year}, month by month`;
  } else if (DAY.test(param("from")) && DAY.test(param("to")) && param("from") <= param("to")) {
    from = param("from");
    to = param("to");
    periodLabel = `${formatDate(from)} – ${formatDate(to)}`;
  } else {
    // Default: the current month (owner, Oct 21).
    month = MONTH.test(param("month")) ? param("month") : today.slice(0, 7);
    from = `${month}-01`;
    const last = format(endOfMonth(parseISO(from)), "yyyy-MM-dd");
    to = last < today ? last : today;
    periodLabel = format(parseISO(from), "MMMM yyyy");
  }
  if (month && !monthOptions.some((m) => m.value === month)) {
    monthOptions.push({ value: month, label: format(parseISO(`${month}-01`), "MMMM yyyy") });
  }

  const a = await loadAnalytics(supabase, from, to, tab === "mom");
  const t = a.totals;
  const mom = tab === "mom";
  const chartData = a.months.map((m) => ({
    label: m.label,
    short: m.label.slice(0, 3),
    requestsIn: m.requestsIn,
    accepted: m.accepted,
    completed: m.completed,
    openAtEnd: m.openAtEnd,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Marketing Design Pipeline · {periodLabel}</p>
      </div>

      <PeriodControls
        tab={tab}
        months={monthOptions}
        month={month}
        from={from}
        to={to}
        years={years}
        year={year}
      />

      {/* Stays at the top while scrolling, so any section is one click away
          (owner, Oct 22). No band behind it (owner, Oct 23): only the buttons
          are pinned, each with its own solid fill; the gaps let clicks
          through to the page. */}
      <nav
        aria-label="Sections"
        className="pointer-events-none sticky top-14 z-30 -mx-1 flex flex-wrap items-center gap-x-1 gap-y-2 px-1 py-2 text-sm"
      >
        <span className="pointer-events-auto mr-1 rounded-full bg-background px-2 py-1 text-muted-foreground">Jump to:</span>
        {JUMPS.map((j) => (
          <a
            key={j.id}
            href={`#${j.id}`}
            className="pointer-events-auto rounded-full border bg-background px-3 py-1 font-medium text-brand shadow-sm transition-colors hover:border-brand/60 hover:bg-brand-soft"
          >
            {j.label}
          </a>
        ))}
      </nav>

      <section id="overview" className="scroll-mt-32 space-y-4">
        <SectionHeader icon={LayoutDashboardIcon} title="Overview" description="The period at a glance" />
        {/* Three grouped cards instead of six boxes (owner, Oct 21). */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardDescription>Request flow</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Flow label="Requests in" value={t.requestsIn} />
                <Flow label="Accepted" value={t.accepted} rate={shareOf(t.accepted, t.requestsIn)} />
                <Flow label="Completed" value={t.completed} rate={shareOf(t.completed, t.requestsIn)} />
                <Flow label="Open at the end" value={t.openAtEnd} note="New request to For revision" />
              </dl>
            </CardContent>
          </Card>
          <SummaryBox title="Average turnaround" value={days(t.avgTurnaround)} lines={["Working days, request to completed"]} />
          <SummaryBox
            title="Feedback (overall)"
            value={t.feedbackRating === null ? "—" : <StarsDisplay value={t.feedbackRating} size="md" />}
            lines={[`${t.feedbackCount} responses (Marketing team excluded)`]}
          />
        </div>
      </section>

      <section id="brand" className="scroll-mt-32 space-y-4">
        <SectionHeader icon={BarChart3Icon} title="Brand Team Productivity" description="How many requests came in, were accepted, finished and still open" />
        {/* Month-by-month view: Month on Month only. */}
        {mom && (
          <>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Total requests vs total accepted</CardTitle>
                <CardDescription>Requests filed each month, and how many of them a designer accepted</CardDescription>
              </CardHeader>
              <CardContent>
                <MonthBars
                  data={chartData}
                  series={[
                    { key: "requestsIn", label: "Requests in" },
                    { key: "accepted", label: "Accepted" },
                  ]}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Requests in vs completed vs open at month-end</CardTitle>
                <CardDescription>Open = New request, Not started, In progress, For review and For revision at month-end</CardDescription>
              </CardHeader>
              <CardContent>
                <MonthBars
                  data={chartData}
                  series={[
                    { key: "requestsIn", label: "Requests in" },
                    { key: "completed", label: "Completed" },
                    { key: "openAtEnd", label: "Open at month-end" },
                  ]}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Pipeline Summary</CardTitle>
              <CardDescription>
                Arrows compare Requests In with the month before. Turnaround counts working days (Mon–Fri) for requests
                completed that month; feedback leaves out Marketing team requesters.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Month</th>
                    <th className={th}>Requests In</th>
                    <th className={th}>Accepted</th>
                    <th className={th}>Completed</th>
                    <th className={th}>Open at Month-End</th>
                    <th className={th}>Avg. Turnaround</th>
                    <th className={th}>Deal Requests</th>
                    <th className={th}>Deal Size</th>
                    <th className={th}>Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {a.months.map((m, i) => {
                    const change = i === 0 ? 0 : m.requestsIn - a.months[i - 1].requestsIn;
                    return (
                      <tr key={m.month} className="border-b last:border-0">
                        <td className="px-3 py-2">{m.label}</td>
                        <td className={td}>
                          <span className="inline-flex items-center gap-1">
                            {m.requestsIn}
                            {change !== 0 && (
                              <span
                                className={`inline-flex items-center text-xs ${change > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}
                                title={`${change > 0 ? "+" : ""}${change} vs ${a.months[i - 1].label}`}
                              >
                                {change > 0 ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />}
                                {Math.abs(change)}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className={td}>{m.accepted}</td>
                        <td className={td}>{m.completed}</td>
                        <td className={td}>{m.openAtEnd}</td>
                        <td className={td}>{days(m.avgTurnaround)}</td>
                        <td className={td}>{m.dealRequests}</td>
                        <td className={td}>{m.dealSize ? formatPeso(m.dealSize) : "—"}</td>
                        <td className={td}>{m.feedbackRating === null ? "—" : `${stars(m.feedbackRating)} ★ (${m.feedbackCount})`}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 font-semibold">
                    <td className="px-3 py-2">{year} total</td>
                    <td className={td}>{t.requestsIn}</td>
                    <td className={td}>{t.accepted}</td>
                    <td className={td}>{t.completed}</td>
                    <td className={td}>—</td>
                    <td className={td}>{days(t.avgTurnaround)}</td>
                    <td className={td}>{t.dealRequests}</td>
                    <td className={td}>{t.dealSize ? formatPeso(t.dealSize) : "—"}</td>
                    <td className={td}>{t.feedbackRating === null ? "—" : `${stars(t.feedbackRating)} ★ (${t.feedbackCount})`}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Key insights</CardTitle>
              <CardDescription>Worked out automatically from the numbers above</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1.5 pl-5 text-sm">
                {insights(a, year).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          </>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          <ShareCard title="Requests per team" data={a.byTeam} total={t.requestsIn} column="Team" />
          <ShareCard title="Request type breakdown" data={a.byType} total={t.requestsIn} column="Type of request" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Requests by status</CardTitle>
            <CardDescription>Where this period&apos;s {t.requestsIn} requests are now</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList data={STATUSES.map((st) => ({ label: st.label, value: a.byStatus.get(st.value) ?? 0 }))} total={t.requestsIn} />
          </CardContent>
        </Card>
      </section>

      <section id="designers" className="scroll-mt-32 space-y-4">
        <SectionHeader icon={UsersIcon} title="Designer Productivity" description="Work each designer completed, with turnaround and feedback" />
        {mom ? (
          <Card>
            <CardHeader>
              <CardDescription>
                Handled: requests filed in this period, by the designer currently assigned. Completed and turnaround:
                requests completed in this period. Feedback leaves out Marketing team requesters.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium">Designer</th>
                    <th className={th}>Handled</th>
                    <th className={th}>Completed</th>
                    <th className={th}>Avg. Turnaround</th>
                    <th className={th}>Feedback</th>
                    {a.months.map((m) => (
                      <th key={m.month} className={th} title={`Completed in ${m.label}`}>
                        {m.label.slice(0, 3)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {a.designers.map((d) => (
                    <tr key={d.name} className="border-b last:border-0">
                      <td className="sticky left-0 z-10 bg-card px-3 py-2 whitespace-nowrap">{d.name}</td>
                      <td className={td}>{d.handled}</td>
                      <td className={td}>{d.completed}</td>
                      <td className={td}>{days(d.avgTurnaround)}</td>
                      <td className={td}>{d.feedbackRating === null ? "—" : `${stars(d.feedbackRating)} ★`}</td>
                      {d.completedByMonth.map((n, i) => (
                        <td key={a.months[i].month} className={`${td} ${n ? "" : "text-muted-foreground"}`}>
                          {n}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {mom && <p className="mt-2 text-xs text-muted-foreground">Month columns: requests completed in that month.</p>}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardDescription>
                Requests completed in this period (by Date Completed), credited to the designer assigned at completion,
                with open work at the end of the period and feedback on those completed requests (Marketing team
                excluded).
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium">Designer</th>
                    {a.periodTypes.map((type) => (
                      <th key={type} className={`${th} whitespace-normal`}>
                        {type}
                      </th>
                    ))}
                    <th className={th}>Total completed</th>
                    <th className={th}>{month ? "Open at month-end" : "Open at end of range"}</th>
                    <th className={th}>Avg. Turnaround</th>
                    <th className={th}>Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {a.designerPeriod.map((d) => (
                    <tr key={d.name} className="border-b last:border-0">
                      <td className="sticky left-0 z-10 bg-card px-3 py-2 whitespace-nowrap">{d.name}</td>
                      {a.periodTypes.map((type) => (
                        <td key={type} className={`${td} ${d.byType[type] ? "" : "text-muted-foreground"}`}>
                          {d.byType[type] ?? 0}
                        </td>
                      ))}
                      <td className={`${td} font-semibold`}>{d.total}</td>
                      <td className={td}>{d.openAtEnd}</td>
                      <td className={td}>{days(d.avgTurnaround)}</td>
                      <td className={td}>
                        {d.feedbackRating === null
                          ? d.feedbackOutOf
                            ? `— (0 of ${d.feedbackOutOf})`
                            : "—"
                          : `${stars(d.feedbackRating)} ★ (${d.feedbackCount} of ${d.feedbackOutOf})`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </section>

      <section id="deals" className="scroll-mt-32 space-y-4">
        <SectionHeader icon={BriefcaseBusinessIcon} title="Deal Requests" description="Requests tied to a deal, and the deal value behind them" />
        <div className="grid gap-4 sm:grid-cols-2">
          <SummaryBox title="Requests with associated deals" value={t.dealRequests} rate={shareOf(t.dealRequests, t.requestsIn)} />
          <SummaryBox title="Total deal size" value={formatPeso(t.dealSize)} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Deal size by type of request</CardTitle>
            <CardDescription>Which kinds of design work support deals, and the deal value behind them</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {a.dealTypes.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No deal requests in this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Type of request</th>
                    <th className={th}>Deal requests</th>
                    <th className={th}>Deal size</th>
                    <th className="w-1/3 px-3 py-2 text-left font-medium">Share of deal size</th>
                  </tr>
                </thead>
                <tbody>
                  {a.dealTypes.map((d) => {
                    const share = t.dealSize ? d.size / t.dealSize : 0;
                    return (
                      <tr key={d.label} className="border-b last:border-0">
                        <td className="px-3 py-2">{d.label}</td>
                        <td className={td}>{d.requests}</td>
                        <td className={td}>{formatPeso(d.size)}</td>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-2">
                            <span className="h-2.5 rounded-r bg-brand" style={{ width: `${share * 80}%` }} aria-hidden />
                            <span className="text-xs font-semibold tabular-nums">{Math.round(share * 100)}%</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>

      <section id="inactive" className="scroll-mt-32 space-y-4">
        <SectionHeader icon={ArchiveIcon} title="Inactive Requests" description="Returned and cancelled requests, including those with a deal" />
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryBox title="Returned" value={t.returned} rate={shareOf(t.returned, t.requestsIn)} lines={["Of this period's requests"]} />
          <SummaryBox title="Cancelled" value={t.cancelled} rate={shareOf(t.cancelled, t.requestsIn)} lines={["Of this period's requests"]} />
          <SummaryBox
            title="Inactive with a deal"
            value={t.inactiveDeals}
            lines={[`Deal size: ${t.inactiveDealSize ? formatPeso(t.inactiveDealSize) : "—"}`]}
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{mom ? "Inactive requests by month and type" : "Inactive requests by type"}</CardTitle>
            <CardDescription>Returned and cancelled requests filed in this period, with the deal size behind them</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 overflow-x-auto">
            {mom && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Month</th>
                    <th className={th}>Returned</th>
                    <th className={th}>Cancelled</th>
                    <th className={th}>Inactive rate</th>
                    <th className={th}>With a deal</th>
                    <th className={th}>Deal size</th>
                  </tr>
                </thead>
                <tbody>
                  {a.months.map((m) => (
                    <tr key={m.month} className="border-b last:border-0">
                      <td className="px-3 py-2">{m.label}</td>
                      <td className={td}>{m.returned}</td>
                      <td className={td}>{m.cancelled}</td>
                      <td className={td}>{m.requestsIn ? shareOf(m.returned + m.cancelled, m.requestsIn) : "—"}</td>
                      <td className={td}>{m.inactiveDeals}</td>
                      <td className={td}>{m.inactiveDealSize ? formatPeso(m.inactiveDealSize) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {a.inactiveTypes.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No returned or cancelled requests in this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Type of request</th>
                    <th className={th}>Returned</th>
                    <th className={th}>Cancelled</th>
                    <th className={th}>Deal size</th>
                  </tr>
                </thead>
                <tbody>
                  {a.inactiveTypes.map((r) => (
                    <tr key={r.label} className="border-b last:border-0">
                      <td className="px-3 py-2">{r.label}</td>
                      <td className={td}>{r.returned}</td>
                      <td className={td}>{r.cancelled}</td>
                      <td className={td}>{r.dealSize ? formatPeso(r.dealSize) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

// A donut with a table beside it (the table is the legend).
function ShareCard({ title, data, total, column }: { title: string; data: Share[]; total: number; column: string }) {
  const slices = foldShares(data);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {slices.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <ShareDonut data={slices} />
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">{column}</th>
                  <th className="py-2 pl-3 text-right font-medium">Requests</th>
                  <th className="py-2 pl-3 text-right font-medium">Rate</th>
                </tr>
              </thead>
              <tbody>
                {slices.map((s) => (
                  <tr key={s.label} className="border-b last:border-0">
                    <td className="py-2">
                      <span className="flex items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.label}
                      </span>
                    </td>
                    <td className="py-2 pl-3 text-right tabular-nums">{s.value}</td>
                    <td className="py-2 pl-3 text-right tabular-nums">{shareOf(s.value, total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// One number in the Request flow card.
function Flow({ label, value, rate, note }: { label: string; value: number; rate?: string; note?: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">
        {value}
        {rate && <span className="text-base font-medium text-muted-foreground"> · {rate}</span>}
      </dd>
      {note && <dd className="text-xs text-muted-foreground">{note}</dd>}
    </div>
  );
}

const pctText = (n: number, of: number) => `${Math.round((n / of) * 100)}%`;

// Plain-language observations from the Month on Month numbers (owner, Oct 21).
// Rules only; no guessing beyond what the tables show.
function insights(a: Analytics, year: string): string[] {
  const t = a.totals;
  const active = a.months.filter((m) => m.requestsIn > 0 || m.completed > 0);
  if (t.requestsIn === 0 && active.length === 0) return [`No requests were filed in ${year} yet.`];
  const out: string[] = [];
  const last = a.months[a.months.length - 1];
  const prev = a.months[a.months.length - 2];
  if (last && prev && prev.requestsIn > 0) {
    const change = last.requestsIn - prev.requestsIn;
    out.push(
      change === 0
        ? `Requests in held steady in ${last.label} (${last.requestsIn}), the same as ${prev.label}.`
        : `Requests in ${change > 0 ? "rose" : "fell"} ${pctText(Math.abs(change), prev.requestsIn)} in ${last.label} (${last.requestsIn} vs ${prev.requestsIn} in ${prev.label}).`,
    );
  } else if (last && last.requestsIn > 0) {
    out.push(`${last.label} is the first month with requests this year (${last.requestsIn}).`);
  }
  const busiest = [...a.months].sort((x, y) => y.requestsIn - x.requestsIn)[0];
  if (busiest && busiest.requestsIn > 0 && active.length > 1) out.push(`${busiest.label} was the busiest month so far, with ${busiest.requestsIn} requests in.`);
  if (t.requestsIn) {
    out.push(
      `${pctText(t.accepted, t.requestsIn)} of this year's requests were accepted by a designer and ${pctText(t.completed, t.requestsIn)} are completed; ${last?.openAtEnd ?? 0} are still open.`,
    );
  }
  if (t.avgTurnaround !== null) {
    const withTurn = a.months.filter((m) => m.avgTurnaround !== null);
    const lt = withTurn[withTurn.length - 1];
    const pt = withTurn[withTurn.length - 2];
    out.push(
      lt && pt
        ? `Average turnaround was ${lt.avgTurnaround!.toFixed(1)} working days in ${lt.label}, ${lt.avgTurnaround! < pt.avgTurnaround! ? "faster" : lt.avgTurnaround! > pt.avgTurnaround! ? "slower" : "the same"} than ${pt.label} (${pt.avgTurnaround!.toFixed(1)}).`
        : `Completed requests took ${t.avgTurnaround.toFixed(1)} working days on average.`,
    );
  }
  if (t.feedbackRating !== null) {
    out.push(`Feedback averages ${t.feedbackRating.toFixed(1)} ★ from ${t.feedbackCount} response${t.feedbackCount === 1 ? "" : "s"} (Marketing team excluded).`);
  }
  const team = a.byTeam[0];
  if (team && t.requestsIn) out.push(`${team.label} filed the most requests (${team.value}, ${pctText(team.value, t.requestsIn)}).`);
  const type = a.byType[0];
  if (type && t.requestsIn) out.push(`${type.label} is the most requested type (${type.value}, ${pctText(type.value, t.requestsIn)}).`);
  if (t.dealRequests) {
    const top = a.dealTypes[0];
    out.push(
      `${t.dealRequests} request${t.dealRequests === 1 ? "" : "s"} supported deals worth ${formatPeso(t.dealSize)}${top ? `, led by ${top.label} (${formatPeso(top.size)})` : ""}.`,
    );
  }
  const inactive = t.returned + t.cancelled;
  if (inactive && t.requestsIn) {
    out.push(
      `${inactive} request${inactive === 1 ? " was" : "s were"} returned or cancelled (${pctText(inactive, t.requestsIn)})${t.inactiveDeals ? `, including ${t.inactiveDeals} with a deal worth ${formatPeso(t.inactiveDealSize)}` : ""}.`,
    );
  }
  return out;
}

// Sections people can jump to from the top of the page (owner, Oct 21).
const JUMPS = [
  { id: "overview", label: "Overview" },
  { id: "brand", label: "Brand Team" },
  { id: "designers", label: "Designers" },
  { id: "deals", label: "Deals" },
  { id: "inactive", label: "Inactive" },
];

// A tinted band that opens each section, so the report reads as sections
// rather than one long page (owner, Oct 21).
function SectionHeader({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border-l-4 border-brand bg-brand-soft px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <h2 className="text-lg font-bold text-brand">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
