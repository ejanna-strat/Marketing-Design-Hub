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
import { FeedbackSummary } from "@/components/feedback/FeedbackSummary";
import { Insights, ShowTable } from "@/components/Insights";
import { SummaryBox, shareOf } from "@/components/SummaryBox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { endOfMonth, format, parseISO, subMonths } from "date-fns";
import { type Analytics, firstRequestDay, loadAnalytics, type MonthCounts, type PeriodTotals } from "@/lib/analytics";
import { CATEGORY_COLORS } from "@/components/charts/palette";
import { formatDate, todayInManila } from "@/lib/dates";
import { requireStaff } from "@/lib/auth";
import { formatPeso } from "@/lib/money";
import { STATUSES } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";
import { DealMonths } from "./DealMonths";
import { PeriodControls } from "./PeriodControls";

const days = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)} days`);
const stars = (v: number | null) => (v === null ? "—" : v.toFixed(1));
const th = "px-3 py-2 text-right font-medium whitespace-nowrap";
const td = "px-3 py-2 text-right tabular-nums whitespace-nowrap";
// Equal-width columns whose headers wrap (Monthly designer table, owner Oct 23).
const thEven = "w-32 min-w-32 px-3 py-2 text-right align-bottom font-medium";

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
        sections={JUMPS}
      />


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
          {/* Same feedback report as the Dashboard (owner, Oct 23). */}
          <FeedbackSummary
            title="Feedback"
            overall={t.feedbackRating}
            process={t.feedbackProcess}
            output={t.feedbackOutput}
            responses={t.feedbackCount}
            completed={t.completedOutside}
          />
        </div>
        {/* Full width under the cards, so opening it doesn't stretch them. */}
        <Insights label="feedback insights" lines={feedbackInsights(t, mom ? a.months : [])} />
        {mom && (
          <Card>
            <CardHeader>
              <CardTitle>Feedback by month</CardTitle>
              <CardDescription>
                Feedback submitted each month (Marketing team requesters excluded), against requests completed that month
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="zebra w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Month</th>
                      <th className={th}>Responses</th>
                      <th className={th}>Completed</th>
                      <th className={th}>Response rate</th>
                      <th className={th}>Process</th>
                      <th className={th}>Output</th>
                      <th className={th}>Overall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.months.map((m) => (
                      <tr key={m.month} className="border-b last:border-0">
                        <td className="px-3 py-2">{m.label}</td>
                        <td className={td}>{m.feedbackCount}</td>
                        <td className={td}>{m.completedOutside}</td>
                        <td className={td}>{m.completedOutside ? shareOf(m.feedbackCount, m.completedOutside) : "—"}</td>
                        <td className={td}>{starText(m.feedbackProcess)}</td>
                        <td className={td}>{starText(m.feedbackOutput)}</td>
                        <td className={td}>{starText(m.feedbackRating)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 font-semibold">
                      <td className="px-3 py-2">{year} total</td>
                      <td className={td}>{t.feedbackCount}</td>
                      <td className={td}>{t.completedOutside}</td>
                      <td className={td}>{t.completedOutside ? shareOf(t.feedbackCount, t.completedOutside) : "—"}</td>
                      <td className={td}>{starText(t.feedbackProcess)}</td>
                      <td className={td}>{starText(t.feedbackOutput)}</td>
                      <td className={td}>{starText(t.feedbackRating)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
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
                <div className="mt-3">
                  <Insights lines={flowInsights(a, year)} />
                </div>
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
            <CardContent className="space-y-3">
              <div className="overflow-x-auto">
              <table className="zebra w-full text-sm">
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
              </div>
              <Insights lines={insights(a, year)} />
            </CardContent>
          </Card>
          </>
        )}

        {/* Month on Month: requests per team and per type as monthly bars
            (owner, Oct 23); the Monthly report keeps the donuts. */}
        {mom ? (
          <div className="grid gap-6 2xl:grid-cols-2">
            <MonthCountsCard title="Requests per team" column="Team" rows={a.teamMonths} months={a.months} year={year} />
            <MonthCountsCard title="Request type breakdown" column="Type of request" rows={a.typeMonths} months={a.months} year={year} />
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            <ShareCard title="Requests per team" data={a.byTeam} total={t.requestsIn} column="Team" />
            <ShareCard title="Request type breakdown" data={a.byType} total={t.requestsIn} column="Type of request" />
          </div>
        )}

        <TurnaroundByType a={a} mom={mom} year={year} />

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
                Each month column is the number of requests the designer completed that month (by Date Completed). Total
                is the year&apos;s completed requests; turnaround counts working days from request to completed; feedback
                leaves out Marketing team requesters.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-x-auto">
              <table className="zebra w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium">Designer</th>
                    {/* Totals first, then the months (owner, Oct 23). */}
                    <th className={th}>Total completed</th>
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
                      <td className="sticky left-0 z-10 bg-inherit px-3 py-2 whitespace-nowrap">{d.name}</td>
                      <td className={`${td} font-semibold`}>{d.completed}</td>
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
              </div>
              <Insights lines={designerInsights(a, t)} />
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
            <CardContent>
              <div className="overflow-x-auto">
              <table className="zebra w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left align-bottom font-medium">Designer</th>
                    {/* Same width for every type column; long names wrap (owner, Oct 23). */}
                    {a.periodTypes.map((type) => (
                      <th key={type} className={thEven}>
                        {type}
                      </th>
                    ))}
                    <th className={thEven}>Total completed</th>
                    <th className={thEven}>
                      {month ? "Open at month-end" : "Open at end of range"}
                    </th>
                    <th className={thEven}>Avg. Turnaround</th>
                    <th className={thEven}>Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {a.designerPeriod.map((d) => (
                    <tr key={d.name} className="border-b last:border-0">
                      <td className="sticky left-0 z-10 bg-inherit px-3 py-2 whitespace-nowrap">{d.name}</td>
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
              </div>
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
        {mom ? (
          <Card>
            <CardHeader>
              <CardTitle>Deal requests by month</CardTitle>
              <CardDescription>
                Requests with a deal filed each month (Returned and Cancelled not counted). Click a month for its
                breakdown by type of request.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DealMonths
                year={year}
                total={{ requests: t.dealRequests, size: t.dealSize }}
                months={a.months.map((m) => ({
                  month: m.month,
                  label: m.label,
                  requests: m.dealRequests,
                  size: m.dealSize,
                  byType: m.dealsByType,
                }))}
              />
            </CardContent>
          </Card>
        ) : (
        <Card>
          <CardHeader>
            <CardTitle>Deal size by type of request</CardTitle>
            <CardDescription>Which kinds of design work support deals, and the deal value behind them</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {a.dealTypes.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No deal requests in this period.</p>
            ) : (
              <table className="zebra w-full text-sm">
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
        )}
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
              <table className="zebra w-full text-sm">
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
              <table className="zebra w-full text-sm">
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
            <table className="zebra w-full text-sm">
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

const starText = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)} ★`);

// Month on Month: requests filed each month per team or type (owner, Oct 23),
// as stacked bars (the 7 biggest, the rest as "Other"), with the numbers in a
// table underneath.
function MonthCountsCard({
  title,
  column,
  rows,
  months,
  year,
}: {
  title: string;
  column: string;
  rows: MonthCounts[];
  months: Analytics["months"];
  year: string;
}) {
  const shown = rows.length > CATEGORY_COLORS.length ? rows.slice(0, CATEGORY_COLORS.length - 1) : rows;
  const rest = rows.slice(shown.length);
  const series = [
    ...shown.map((r, i) => ({ key: `s${i}`, label: r.label, color: CATEGORY_COLORS[i] })),
    ...(rest.length ? [{ key: "other", label: "Other", color: "#9ca3af" }] : []),
  ];
  const data = months.map((m, mi) => ({
    label: m.label,
    short: m.label.slice(0, 3),
    ...Object.fromEntries(shown.map((r, i) => [`s${i}`, r.counts[mi]])),
    ...(rest.length ? { other: rest.reduce((n, r) => n + r.counts[mi], 0) } : {}),
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Requests filed each month</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <>
            <MonthBars data={data} series={series} stacked />
            {/* The numbers table opens on request (owner, Oct 23). */}
            <ShowTable label={`${column.toLowerCase()} table`}>
            <div className="overflow-x-auto">
              <table className="zebra w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium">{column}</th>
                    {months.map((m) => (
                      <th key={m.month} className={th}>
                        {m.label.slice(0, 3)}
                      </th>
                    ))}
                    <th className={th}>{year} total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label} className="border-b last:border-0">
                      <td className="sticky left-0 z-10 bg-inherit px-3 py-2 whitespace-nowrap">{r.label}</td>
                      {r.counts.map((n, i) => (
                        <td key={months[i].month} className={`${td} ${n ? "" : "text-muted-foreground"}`}>
                          {n}
                        </td>
                      ))}
                      <td className={`${td} font-semibold`}>{r.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </ShowTable>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Average turnaround per type of request, a basis for SLAs (owner, Oct 23).
// Monthly report: the period. Month on Month: each month, with an arrow
// against the type's previous month, and the whole year.
function TurnaroundByType({ a, mom, year }: { a: Analytics; mom: boolean; year: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Turnaround per type of request</CardTitle>
        <CardDescription>
          Working days (Mon–Fri) from request date to completed, for requests completed {mom ? "each month" : "in this period"}. A
          basis for SLAs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {a.typeTurnaround.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No completed requests in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="zebra w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium">Type of request</th>
                  {/* Totals first, then the months (owner, Oct 23). */}
                  <th className={th}>{mom ? `${year} average` : "Avg. Turnaround"}</th>
                  <th className={th}>Completed</th>
                  {mom &&
                    a.months.map((m) => (
                      <th key={m.month} className={th}>
                        {m.label.slice(0, 3)}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {a.typeTurnaround.map((r) => {
                  let previous: number | null = null;
                  return (
                    <tr key={r.label} className="border-b last:border-0">
                      <td className="sticky left-0 z-10 bg-inherit px-3 py-2 whitespace-nowrap">{r.label}</td>
                      <td className={`${td} font-semibold`}>{days(r.avg)}</td>
                      <td className={td}>{r.completed}</td>
                      {mom &&
                        r.months.map((m, i) => {
                          const before = previous;
                          if (m.avg !== null) previous = m.avg;
                          const change = m.avg === null || before === null ? 0 : m.avg - before;
                          return (
                            <td
                              key={a.months[i].month}
                              className={`${td} ${m.avg === null ? "text-muted-foreground" : ""}`}
                              title={m.completed ? `${m.completed} completed in ${a.months[i].label}` : undefined}
                            >
                              {m.avg === null ? (
                                "—"
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  {m.avg.toFixed(1)}
                                  {Math.abs(change) >= 0.05 && (
                                    // Slower (more days) is red, faster is green.
                                    <span
                                      className={change > 0 ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}
                                      title={`${change > 0 ? "Slower" : "Faster"} than the month before (${before!.toFixed(1)})`}
                                    >
                                      {change > 0 ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />}
                                    </span>
                                  )}
                                </span>
                              )}
                            </td>
                          );
                        })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {mom && (
              <p className="mt-2 text-xs text-muted-foreground">
                Month columns: average working days for that month&apos;s completions. ↑ slower / ↓ faster than the
                type&apos;s previous month with completions.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Requests in vs completed vs open at month-end (owner, Oct 23).
function flowInsights(a: Analytics, year: string): string[] {
  const t = a.totals;
  const active = a.months.filter((m) => m.requestsIn > 0 || m.completed > 0 || m.openAtEnd > 0);
  if (active.length === 0) return [];
  const out: string[] = [];
  const last = a.months[a.months.length - 1];
  const prev = a.months[a.months.length - 2];
  if (last) {
    if (last.completed < last.requestsIn) {
      out.push(
        `In ${last.label}, ${last.requestsIn} request${last.requestsIn === 1 ? "" : "s"} came in and ${last.completed} ${last.completed === 1 ? "was" : "were"} completed: more came in than the team finished, so ${last.openAtEnd} ${last.openAtEnd === 1 ? "is" : "are"} still open at the end of the month.`,
      );
    } else if (last.completed > last.requestsIn) {
      out.push(
        `In ${last.label}, the team completed ${last.completed} while ${last.requestsIn} came in, so it is catching up on open work (${last.openAtEnd} open at the end of the month).`,
      );
    } else if (last.requestsIn > 0) {
      out.push(`In ${last.label}, the team completed as many requests as came in (${last.requestsIn}).`);
    }
    if (last.completed === 0 && last.openAtEnd > 0) {
      out.push(`Nothing was completed in ${last.label} while ${last.openAtEnd} stayed open; check Pendings for requests that may be stuck.`);
    }
  }
  if (last && prev && (prev.openAtEnd > 0 || last.openAtEnd > 0) && last.openAtEnd !== prev.openAtEnd) {
    out.push(
      `Open work ${last.openAtEnd > prev.openAtEnd ? "grew" : "went down"} from ${prev.openAtEnd} at the end of ${prev.label} to ${last.openAtEnd} at the end of ${last.label}.`,
    );
  }
  if (t.requestsIn) {
    out.push(`So far in ${year}, ${t.requestsIn} requests came in and ${t.completed} were completed (${pctText(t.completed, t.requestsIn)}).`);
  }
  const peak = [...a.months].sort((x, y) => y.openAtEnd - x.openAtEnd)[0];
  if (peak && peak.openAtEnd > 0 && active.length > 1) out.push(`Open work peaked at ${peak.openAtEnd} at the end of ${peak.label}.`);
  return out;
}

// What the feedback says (owner, Oct 23). With months (Month on Month), also
// the best and lowest month.
function feedbackInsights(t: PeriodTotals, months: Analytics["months"]): string[] {
  const out: string[] = [];
  if (t.feedbackCount === 0) {
    if (t.completedOutside) out.push(`None of the ${t.completedOutside} completed requests in this period have feedback yet.`);
    return out;
  }
  const p = t.feedbackProcess!;
  const o = t.feedbackOutput!;
  if (o - p >= 0.3) {
    out.push(
      `Requesters rate the output (${o.toFixed(1)} ★) higher than the process (${p.toFixed(1)} ★). The Process rating covers the whole request experience (submitting, working with the team, getting the output); the written comments can show which part.`,
    );
  } else if (p - o >= 0.3) {
    out.push(
      `Requesters rate the process (${p.toFixed(1)} ★) higher than the output (${o.toFixed(1)} ★). The Output rating covers the quality and usefulness of the designs; the written comments can show what was missing.`,
    );
  } else {
    out.push(`Process (${p.toFixed(1)} ★) and Output (${o.toFixed(1)} ★) are rated about the same.`);
  }
  if (t.completedOutside) {
    const rate = Math.round((t.feedbackCount / t.completedOutside) * 100);
    out.push(
      rate < 50
        ? `Only ${t.feedbackCount} of ${t.completedOutside} completed requests (${rate}%) have feedback, so these averages rest on a few responses. More responses make them more reliable.`
        : `${t.feedbackCount} of ${t.completedOutside} completed requests (${rate}%) have feedback.`,
    );
  }
  if (t.feedbackLow) {
    out.push(
      `${t.feedbackLow} response${t.feedbackLow === 1 ? "" : "s"} rated 3 ★ or below on Process or Output. Read ${t.feedbackLow === 1 ? "it" : "them"} on the Feedback page to see what went wrong.`,
    );
  }
  if (t.feedbackComments) {
    out.push(`${t.feedbackComments} response${t.feedbackComments === 1 ? " includes" : "s include"} written comments (on the Feedback page).`);
  }
  const rated = months.filter((m) => m.feedbackRating !== null);
  if (rated.length > 1) {
    const best = [...rated].sort((x, y) => y.feedbackRating! - x.feedbackRating!)[0];
    const low = [...rated].sort((x, y) => x.feedbackRating! - y.feedbackRating!)[0];
    if (best.month !== low.month) {
      out.push(
        `${best.label} had the best rating (${best.feedbackRating!.toFixed(1)} ★) and ${low.label} the lowest (${low.feedbackRating!.toFixed(1)} ★).`,
      );
    }
  }
  return out;
}

// Why designers' completed counts differ (owner, Oct 23): a low count isn't
// low effort when the work is mostly slower types (e.g. videos).
function designerInsights(a: Analytics, t: PeriodTotals): string[] {
  const out: string[] = [];
  const typeDays = new Map(a.typeTurnaround.map((r) => [r.label, r.avg]));
  const overall = t.avgTurnaround;
  out.push(
    "Completed counts don't show effort on their own: some types of request take much longer than others (see Turnaround per type of request).",
  );
  const idle: string[] = [];
  for (const d of a.designers) {
    const types = Object.entries(d.completedByType).sort((x, y) => y[1] - x[1]);
    if (d.completed === 0) {
      if (d.openNow > 0) out.push(`${d.name} has nothing completed yet but ${d.openNow} open request${d.openNow === 1 ? "" : "s"} in progress.`);
      else idle.push(d.name);
      continue;
    }
    const [topType, topCount] = types[0];
    // The average turnaround of the types this designer completed, weighted
    // by how many of each.
    const mixDays = types.reduce((sum, [type, n]) => sum + (typeDays.get(type) ?? 0) * n, 0) / d.completed;
    const mix = types.map(([type, n]) => `${type} (${n})`).join(", ");
    if (overall !== null && mixDays > overall * 1.2 && mixDays - overall >= 0.5) {
      out.push(
        `${d.name} completed ${d.completed}, mostly ${topType} (${topCount}). These types take ${mixDays.toFixed(1)} working days on average vs ${overall.toFixed(1)} across all work, so a lower count can still be a full workload.`,
      );
    } else {
      out.push(`${d.name} completed ${d.completed}: ${mix}.`);
    }
    if (d.openNow > 0) out[out.length - 1] += ` ${d.openNow} more ${d.openNow === 1 ? "is" : "are"} open now.`;
  }
  if (idle.length) {
    const names = idle.length === 1 ? idle[0] : `${idle.slice(0, -1).join(", ")} and ${idle[idle.length - 1]}`;
    out.push(`${names} ${idle.length === 1 ? "has" : "have"} no completed or open requests in this period.`);
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
