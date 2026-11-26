import { TZDate } from "@date-fns/tz";
import { differenceInBusinessDays, format, parseISO } from "date-fns";
import { theme } from "@/config/theme";

// Turnaround and deadlines (owner, Nov 26), shared by the Dashboard and
// Analytics:
// - First draft turnaround: working days from the request date to the first
//   time it was sent as "For review – 1st draft" (`first_draft_at`).
// - Final turnaround: working days from the request date to Completed.
// - On time: the 1st draft was sent on or before the First Draft Deadline;
//   the request was Completed on or before the Final Deadline (Date Needed).

const DAY = 86_400_000;
// Manila has no daylight saving: always UTC+8.
const MANILA_OFFSET = 8 * 3_600_000;

export const manilaDay = (ts: string) => format(new TZDate(new Date(ts).getTime(), theme.timeZone), "yyyy-MM-dd");

// Whole working days (Mon–Fri) between two moments, by Manila calendar date.
export const workingDays = (from: string, to: string) =>
  Math.max(0, differenceInBusinessDays(parseISO(manilaDay(to)), parseISO(manilaDay(from))));

export const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

// Working time between two moments in days, with fractions: only Mon–Fri
// (Manila) count, so a 3-hour review on a Tuesday is 0.125 days and a weekend
// adds nothing. Used for the review back-and-forth, where many steps take
// less than a day.
export function workingTime(from: string, to: string): number {
  const start = new Date(from).getTime() + MANILA_OFFSET;
  const end = new Date(to).getTime() + MANILA_OFFSET;
  let total = 0;
  for (let day = Math.floor(start / DAY) * DAY; day < end; day += DAY) {
    const weekday = new Date(day).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    total += Math.max(0, Math.min(end, day + DAY) - Math.max(start, day));
  }
  return total / DAY;
}

export type DeadlineRow = {
  status: string;
  created_at: string;
  date_completed: string | null;
  date_needed: string;
  first_draft_at: string | null;
  first_draft_due: string | null;
};

export type DeadlineStats = {
  // Average working days to the 1st draft, and how many 1st drafts.
  avgFirstDraft: number | null;
  firstDrafts: number;
  // 1st drafts with a First Draft Deadline, and how many met it.
  firstOnTime: number;
  firstOnTimeOf: number;
  // Completed requests, and how many met the Final Deadline.
  finalOnTime: number;
  finalOnTimeOf: number;
};

// `within`: whether a moment is in the period. A 1st draft counts in the
// period it was sent; a completion in the period it was completed.
export function deadlineStats(rows: DeadlineRow[], within: (ts: string | null) => boolean): DeadlineStats {
  const drafts = rows.filter((r) => within(r.first_draft_at));
  const dueDrafts = drafts.filter((r) => r.first_draft_due);
  const done = rows.filter((r) => r.status === "completed" && within(r.date_completed));
  return {
    avgFirstDraft: average(drafts.map((r) => workingDays(r.created_at, r.first_draft_at!))),
    firstDrafts: drafts.length,
    firstOnTime: dueDrafts.filter((r) => manilaDay(r.first_draft_at!) <= r.first_draft_due!).length,
    firstOnTimeOf: dueDrafts.length,
    finalOnTime: done.filter((r) => manilaDay(r.date_completed!) <= r.date_needed).length,
    finalOnTimeOf: done.length,
  };
}

// "75%" (or "—" when there's nothing to count).
export const onTimeRate = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "—");

export const daysText = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${v.toFixed(1)} days`;
