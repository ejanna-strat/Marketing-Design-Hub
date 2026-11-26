import { SummaryBox } from "@/components/SummaryBox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MonthRow, PeriodTotals } from "@/lib/analytics";
import { daysText, onTimeRate } from "@/lib/turnaround";

const th = "px-3 py-2 text-right font-medium whitespace-nowrap";
const td = "px-3 py-2 text-right tabular-nums whitespace-nowrap";
const num = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toFixed(1));

// Turnaround and the review back-and-forth (owner, Nov 26): the deadlines
// met, then how long the review rounds take and who they wait on. Month on
// Month adds a month-by-month table.
export function ReviewCards({ t, months, mom }: { t: PeriodTotals; months: MonthRow[]; mom: boolean }) {
  const [at1, at2, at3] = t.finishedAt;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryBox
          title="1st draft to completed"
          value={daysText(t.avgReviewDays)}
          lines={["The whole review stretch, on average"]}
        />
        <SummaryBox
          title="Waiting on the requester"
          value={daysText(t.avgRequesterDays)}
          lines={["Time in a For review round"]}
        />
        <SummaryBox
          title="With the designer"
          value={daysText(t.avgDesignerDays)}
          lines={["Time in For revision or In progress after the 1st draft"]}
        />
        <SummaryBox
          title="Review rounds per request"
          value={num(t.avgRounds)}
          lines={[`Finished at 1st draft ${at1} · V2 ${at2} · V3 ${at3}`]}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        For the {t.reviewed} request{t.reviewed === 1 ? "" : "s"} completed in this period that went through review.
        Working days (Mon–Fri) with fractions, so a review that took a morning counts as part of a day. On hold time
        counts in the whole stretch only.
      </p>

      {mom && (
        <Card>
          <CardHeader>
            <CardTitle>Turnaround and reviews by month</CardTitle>
            <CardDescription>
              1st drafts count in the month they were sent; completions in the month they were completed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="zebra w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium">Month</th>
                    <th className={th}>To 1st draft</th>
                    <th className={th}>To completed</th>
                    <th className={th}>1st draft on time</th>
                    <th className={th}>Final Deadline met</th>
                    <th className={th}>Review stretch</th>
                    <th className={th}>Requester</th>
                    <th className={th}>Designer</th>
                    <th className={th}>Rounds</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => (
                    <tr key={m.month} className="border-b last:border-0">
                      <td className="sticky left-0 z-10 bg-inherit px-3 py-2">{m.label}</td>
                      <td className={td}>{num(m.avgFirstDraft)}</td>
                      <td className={td}>{num(m.avgTurnaround)}</td>
                      <td className={td}>{onTimeRate(m.firstOnTime, m.firstOnTimeOf)}</td>
                      <td className={td}>{onTimeRate(m.finalOnTime, m.finalOnTimeOf)}</td>
                      <td className={td}>{num(m.avgReviewDays)}</td>
                      <td className={td}>{num(m.avgRequesterDays)}</td>
                      <td className={td}>{num(m.avgDesignerDays)}</td>
                      <td className={td}>{num(m.avgRounds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Days are working days. Requester = waiting in a For review round; Designer = For revision or In progress
              after the 1st draft.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
