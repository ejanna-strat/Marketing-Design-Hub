import "server-only";
import { TZDate } from "@date-fns/tz";
import { addDays, addMonths, differenceInBusinessDays, format, parseISO } from "date-fns";
import { theme } from "@/config/theme";
import { manilaDayStart } from "@/lib/dates";
import { one } from "@/lib/feedback";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Analytics / Reports (§7.2 #6, pulled forward Oct 21). Two tabs (owner,
// Oct 21): a Monthly report for any period, and Month on Month for a year.
// Both use the same reports; Month on Month adds the month-by-month view.

// A request counts as Accepted once it reached Designer assigned or later.
const ACCEPTED = new Set(["designer_assigned", "in_progress", "for_review", "for_revision", "completed"]);
// "Open at the end" = Not started + In progress (owner's report).
const OPEN_AT_END = new Set(["designer_assigned", "in_progress"]);

const manilaDay = (ts: string) => format(new TZDate(new Date(ts).getTime(), theme.timeZone), "yyyy-MM-dd");
const workingDays = (from: string, to: string) =>
  Math.max(0, differenceInBusinessDays(parseISO(manilaDay(to)), parseISO(manilaDay(from))));
const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const nextDay = (day: string) => format(addDays(parseISO(day), 1), "yyyy-MM-dd");

// PostgREST returns at most 1,000 rows per call, so read in pages.
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

export type Share = { label: string; value: number };

export type PeriodTotals = {
  requestsIn: number;
  accepted: number;
  completed: number;
  openAtEnd: number;
  avgTurnaround: number | null;
  dealRequests: number;
  dealSize: number;
  feedbackRating: number | null;
  feedbackCount: number;
};

export type MonthRow = PeriodTotals & { month: string; label: string };

// Monthly report's Designer Productivity (owner, Oct 21): requests completed
// in the period, by type, credited to the designer assigned at completion.
export type DesignerPeriodRow = {
  name: string;
  byType: Record<string, number>;
  total: number;
  openAtEnd: number;
  avgTurnaround: number | null;
  feedbackRating: number | null;
  feedbackCount: number;
  feedbackOutOf: number;
};

export type DesignerRow = {
  name: string;
  handled: number;
  completed: number;
  avgTurnaround: number | null;
  feedbackRating: number | null;
  completedByMonth: number[];
};

// Reports for the Manila days `from`–`to` (both included). With `byMonth`,
// also every month of that range (Month on Month).
export async function loadAnalytics(supabase: Supabase, from: string, to: string, byMonth = false) {
  const start = manilaDayStart(from);
  const end = manilaDayStart(nextDay(to));

  // Every request filed before the end: filed, completed and still-open
  // counts all come from this list.
  const [requests, history, feedback, designers] = await Promise.all([
    readAll((a, b) =>
      supabase
        .from("requests")
        .select(
          "id, status, created_at, date_completed, assigned_designer_id, is_deal, deal_size, team:teams(name, is_marketing), request_type:request_types(name, sort_order), feedback(process_rating, output_rating)",
        )
        .lt("created_at", end)
        .order("created_at")
        .range(a, b),
    ),
    readAll((a, b) =>
      supabase
        .from("activity_log")
        .select("request_id, to_value, created_at")
        .eq("action", "status")
        .lt("created_at", end)
        .order("created_at")
        .range(a, b),
    ),
    readAll((a, b) =>
      supabase
        .from("feedback")
        .select("process_rating, output_rating, submitted_at, request:requests(assigned_designer_id, team:teams(is_marketing))")
        .gte("submitted_at", start)
        .lt("submitted_at", end)
        .range(a, b),
    ),
    supabase.from("designers").select("id, display_name, active").order("display_name"),
  ]);

  // Status changes per request, oldest first.
  const changes = new Map<string, { status: string; at: string }[]>();
  for (const h of history) {
    if (!h.to_value) continue;
    const list = changes.get(h.request_id) ?? [];
    list.push({ status: h.to_value, at: h.created_at });
    changes.set(h.request_id, list);
  }
  type Req = (typeof requests)[number];
  const everAccepted = (r: Req) => ACCEPTED.has(r.status) || (changes.get(r.id) ?? []).some((c) => ACCEPTED.has(c.status));
  // A request's status at a moment: its last change before then.
  const statusAt = (id: string, moment: string) => {
    let status = "new_request";
    for (const c of changes.get(id) ?? []) if (c.at < moment) status = c.status;
    return status;
  };

  const counted = feedback.filter((f) => !one(f.request)?.team?.is_marketing);
  type Fb = (typeof counted)[number];
  const overall = (list: Fb[]) => {
    const p = average(list.map((f) => f.process_rating));
    const o = average(list.map((f) => f.output_rating));
    return p === null || o === null ? null : (p + o) / 2;
  };

  const isCompleted = (r: Req) => r.status === "completed" && !!r.date_completed;
  // Deal numbers leave out Returned and Cancelled requests (owner, Oct 21).
  const isDeal = (r: Req) => r.is_deal && r.status !== "rejected" && r.status !== "cancelled";
  const totalsFor = (s: string, e: string): PeriodTotals => {
    const within = (ts: string | null) => !!ts && ts >= s && ts < e;
    const filed = requests.filter((r) => within(r.created_at));
    const done = requests.filter((r) => isCompleted(r) && within(r.date_completed));
    const fb = counted.filter((f) => within(f.submitted_at));
    const deals = filed.filter(isDeal);
    return {
      requestsIn: filed.length,
      accepted: filed.filter(everAccepted).length,
      completed: done.length,
      openAtEnd: requests.filter((r) => r.created_at < e && OPEN_AT_END.has(statusAt(r.id, e))).length,
      avgTurnaround: average(done.map((r) => workingDays(r.created_at, r.date_completed!))),
      dealRequests: deals.length,
      dealSize: deals.reduce((n, r) => n + (r.deal_size ?? 0), 0),
      feedbackRating: overall(fb),
      feedbackCount: fb.length,
    };
  };

  const months: MonthRow[] = [];
  if (byMonth) {
    for (let m = parseISO(`${from.slice(0, 7)}-01`); format(m, "yyyy-MM") <= to.slice(0, 7); m = addMonths(m, 1)) {
      const month = format(m, "yyyy-MM");
      const s = manilaDayStart(`${month}-01`);
      const e = manilaDayStart(format(addMonths(m, 1), "yyyy-MM-dd"));
      // The current month ends now (the end of the range).
      months.push({ month, label: format(m, "MMMM"), ...totalsFor(s, e < end ? e : end) });
    }
  }

  const filed = requests.filter((r) => r.created_at >= start);
  const shares = (key: (r: Req) => string): Share[] => {
    const m = new Map<string, number>();
    for (const r of filed) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };

  const doneInPeriod = requests.filter((r) => isCompleted(r) && r.date_completed! >= start && r.date_completed! < end);
  const designerRows: DesignerRow[] = (designers.data ?? [])
    .map((d) => {
      const done = doneInPeriod.filter((r) => r.assigned_designer_id === d.id);
      return {
        // Two designers can share a first name; former ones are marked.
        name: d.active ? d.display_name : `${d.display_name} (former)`,
        active: d.active,
        handled: filed.filter((r) => r.assigned_designer_id === d.id).length,
        completed: done.length,
        avgTurnaround: average(done.map((r) => workingDays(r.created_at, r.date_completed!))),
        feedbackRating: overall(counted.filter((f) => one(f.request)?.assigned_designer_id === d.id)),
        completedByMonth: months.map((m) => done.filter((r) => manilaDay(r.date_completed!).startsWith(m.month)).length),
      };
    })
    .filter((d) => d.active || d.handled > 0 || d.completed > 0);

  // Monthly report: completed in the period (by Date Completed, Manila),
  // credited to the designer assigned at completion (locked once Completed).
  // Open at the end = assigned to them and not Completed, Cancelled or
  // Returned at the end of the period. Feedback = feedback on those same
  // completed requests, whenever it was submitted, Marketing team excluded.
  const closed = new Set(["completed", "cancelled", "rejected"]);
  const periodTypes = [...new Map(doneInPeriod.map((r) => [r.request_type?.name ?? "—", r.request_type?.sort_order ?? 99]))]
    .sort((x, y) => x[1] - y[1])
    .map(([name]) => name);
  const designerPeriod: DesignerPeriodRow[] = (designers.data ?? [])
    .map((d) => {
      const done = doneInPeriod.filter((r) => r.assigned_designer_id === d.id);
      const outside = done.filter((r) => !r.team?.is_marketing);
      const rated = outside.map((r) => one(r.feedback)).filter((f): f is NonNullable<typeof f> => !!f);
      const p = average(rated.map((f) => f.process_rating));
      const o = average(rated.map((f) => f.output_rating));
      const byType: Record<string, number> = {};
      for (const r of done) byType[r.request_type?.name ?? "—"] = (byType[r.request_type?.name ?? "—"] ?? 0) + 1;
      return {
        name: d.active ? d.display_name : `${d.display_name} (former)`,
        active: d.active,
        byType,
        total: done.length,
        openAtEnd: requests.filter(
          (r) => r.assigned_designer_id === d.id && r.created_at < end && !closed.has(statusAt(r.id, end)),
        ).length,
        avgTurnaround: average(done.map((r) => workingDays(r.created_at, r.date_completed!))),
        feedbackRating: p === null || o === null ? null : (p + o) / 2,
        feedbackCount: rated.length,
        feedbackOutOf: outside.length,
      };
    })
    .filter((d) => d.active || d.total > 0 || d.openAtEnd > 0);

  // Deals by type of request: how many deal requests, and their deal size.
  const dealTypes = new Map<string, { label: string; requests: number; size: number }>();
  for (const r of filed.filter(isDeal)) {
    const label = r.request_type?.name ?? "—";
    const t = dealTypes.get(label) ?? { label, requests: 0, size: 0 };
    t.requests += 1;
    t.size += r.deal_size ?? 0;
    dealTypes.set(label, t);
  }

  return {
    totals: totalsFor(start, end),
    months,
    byTeam: shares((r) => r.team?.name ?? "—"),
    byType: shares((r) => r.request_type?.name ?? "—"),
    designers: designerRows,
    designerPeriod,
    periodTypes,
    dealTypes: [...dealTypes.values()].sort((a, b) => b.size - a.size || b.requests - a.requests),
  };
}

export type Analytics = Awaited<ReturnType<typeof loadAnalytics>>;

// The day of the first request, for the year and month pickers.
export async function firstRequestDay(supabase: Supabase) {
  const { data } = await supabase.from("requests").select("created_at").order("created_at").limit(1).maybeSingle();
  return data ? manilaDay(data.created_at) : null;
}
