import type { MetricTile } from "@/components/MetricRows";
import { type DeadlineStats, daysText, onTimeRate } from "@/lib/turnaround";

// The Turnaround row of the Request flow card (owner, Nov 26), on the
// Dashboard and Analytics: working days to the 1st draft and to completed,
// and how many met their deadline.
export function turnaroundRow(s: DeadlineStats, avgFinal: number | null, href?: string) {
  const tiles: MetricTile[] = [
    {
      label: "Turnaround to 1st draft",
      value: daysText(s.avgFirstDraft),
      note: `Working days, request to 1st draft (${s.firstDrafts} sent)`,
      tone: "violet",
      href,
    },
    {
      label: "Turnaround to completed",
      value: daysText(avgFinal),
      note: "Working days, request to completed",
      tone: "violet",
      href,
    },
    {
      label: "1st draft on time",
      value: onTimeRate(s.firstOnTime, s.firstOnTimeOf),
      note: s.firstOnTimeOf
        ? `${s.firstOnTime} of ${s.firstOnTimeOf} by the First Draft Deadline`
        : "No 1st drafts with a deadline yet",
      tone: "green",
      href,
    },
    {
      label: "Final Deadline met",
      value: onTimeRate(s.finalOnTime, s.finalOnTimeOf),
      note: s.finalOnTimeOf ? `${s.finalOnTime} of ${s.finalOnTimeOf} completed on time` : "Nothing completed yet",
      tone: "green",
      href,
    },
  ];
  return { label: "Turnaround", basis: "working days (Mon–Fri) · on time = by the deadline", tiles };
}
