import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { MonthBars } from "@/components/charts/MonthBars";
import { foldShares, type Share } from "@/components/charts/palette";
import { ShareDonut } from "@/components/charts/ShareDonut";
import { StarsDisplay } from "@/components/feedback/Stars";
import { SummaryBox, shareOf } from "@/components/SummaryBox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadAnalytics } from "@/lib/analytics";
import { requireStaff } from "@/lib/auth";
import { formatPeso } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { ExportCsv } from "./ExportCsv";

const days = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)} days`);
const stars = (v: number | null) => (v === null ? "—" : v.toFixed(1));
const th = "px-3 py-2 text-right font-medium whitespace-nowrap";
const td = "px-3 py-2 text-right tabular-nums whitespace-nowrap";

// Analytics / Reports (§7.2 #6, pulled forward Oct 21): every month of the
// year so far, plus deal requests by type.
export default async function AnalyticsPage() {
  await requireStaff();
  const a = await loadAnalytics(await createClient());
  const t = a.totals;
  const chartData = a.months.map((m) => ({
    label: m.label,
    short: m.label.slice(0, 3),
    requestsIn: m.requestsIn,
    accepted: m.accepted,
    completed: m.completed,
    openAtMonthEnd: m.openAtMonthEnd,
  }));

  const csv: (string | number)[][] = [
    [
      "Month",
      "Requests In",
      "Accepted",
      "Completed",
      "Open at Month-End",
      "Avg. Turnaround (working days)",
      "Deal Requests",
      "Deal Size (PHP)",
      "Feedback Rating",
      "Feedback Responses",
    ],
    ...a.months.map((m) => [
      m.label,
      m.requestsIn,
      m.accepted,
      m.completed,
      m.openAtMonthEnd,
      m.avgTurnaround === null ? "" : m.avgTurnaround.toFixed(1),
      m.dealRequests,
      m.dealSize,
      m.feedbackRating === null ? "" : m.feedbackRating.toFixed(2),
      m.feedbackCount,
    ]),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Marketing Design Pipeline {a.year}, month by month.</p>
        </div>
        <ExportCsv filename={`marketing-design-analytics-${a.year}.csv`} rows={csv} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryBox title="Requests in" value={t.requestsIn} />
        <SummaryBox title="Accepted" value={t.accepted} rate={shareOf(t.accepted, t.requestsIn)} />
        <SummaryBox title="Completed" value={t.completed} rate={shareOf(t.completed, t.requestsIn)} />
        <SummaryBox title="Average turnaround" value={days(t.avgTurnaround)} lines={["Working days, request to completed"]} />
        <SummaryBox
          title="Feedback (overall)"
          value={t.feedbackRating === null ? "—" : <StarsDisplay value={t.feedbackRating} size="md" />}
          lines={[`${t.feedbackCount} responses (Marketing team excluded)`]}
        />
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Brand Team Productivity</h2>
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
              <CardDescription>Open = Not started + In progress at the end of the month</CardDescription>
            </CardHeader>
            <CardContent>
              <MonthBars
                data={chartData}
                series={[
                  { key: "requestsIn", label: "Requests in" },
                  { key: "completed", label: "Completed" },
                  { key: "openAtMonthEnd", label: "Open at month-end" },
                ]}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Month by month</CardTitle>
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
                              className={`inline-flex items-center text-xs ${change > 0 ? "text-emerald-700" : "text-red-700"}`}
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
                      <td className={td}>{m.openAtMonthEnd}</td>
                      <td className={td}>{days(m.avgTurnaround)}</td>
                      <td className={td}>{m.dealRequests}</td>
                      <td className={td}>{m.dealSize ? formatPeso(m.dealSize) : "—"}</td>
                      <td className={td}>{m.feedbackRating === null ? "—" : `${stars(m.feedbackRating)} ★ (${m.feedbackCount})`}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 font-semibold">
                  <td className="px-3 py-2">{a.year} total</td>
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

        <div className="grid gap-6 xl:grid-cols-2">
          <ShareCard title="Requests per team" data={a.byTeam} total={t.requestsIn} column="Team" />
          <ShareCard title="Request type breakdown" data={a.byType} total={t.requestsIn} column="Type of request" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Designer Productivity</h2>
        <Card>
          <CardHeader>
            <CardDescription>
              Requests filed in {a.year}, by the designer currently assigned. Feedback leaves out Marketing team
              requesters.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Designer</th>
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
                    <td className="px-3 py-2">{d.name}</td>
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
            <p className="mt-2 text-xs text-muted-foreground">Month columns: requests completed in that month.</p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Deal Requests</h2>
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
              <p className="py-6 text-center text-sm text-muted-foreground">No deal requests yet this year.</p>
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
