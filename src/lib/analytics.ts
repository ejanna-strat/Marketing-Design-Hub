import "server-only";
import { TZDate } from "@date-fns/tz";
import { addMonths, differenceInBusinessDays, format, parseISO } from "date-fns";
import { theme } from "@/config/theme";
import { manilaDayStart, todayInManila } from "@/lib/dates";
import { one } from "@/lib/feedback";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Analytics / Reports (§7.2 #6, pulled forward Oct 21): every month of the
// year so far, from the requests, their status history and feedback.

// A request counts as Accepted once it reached Designer assigned or later.
const ACCEPTED = new Set(["designer_assigned", "in_progress", "for_review", "for_revision", "completed"]);
// "Open at month-end" = Not started + In progress (owner's report).
const OPEN_AT_MONTH_END = new Set(["designer_assigned", "in_progress"]);

const manilaDay = (ts: string) => format(new TZDate(new Date(ts).getTime(), theme.timeZone), "yyyy-MM-dd");
const workingDays = (from: string, to: string) =>
  Math.max(0, differenceInBusinessDays(parseISO(manilaDay(to)), parseISO(manilaDay(from))));
const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

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

export type MonthRow = {
  month: string; // "2026-10"
  label: string; // "October"
  requestsIn: number;
  accepted: number;
  completed: number;
  openAtMonthEnd: number;
  avgTurnaround: number | null;
  dealRequests: number;
  dealSize: number;
  feedbackRating: number | null;
  feedbackCount: number;
};

export type DesignerRow = {
  name: string;
  handled: number;
  completed: number;
  avgTurnaround: number | null;
  feedbackRating: number | null;
  completedByMonth: number[];
};

export type Share = { label: string; value: number };

export async function loadAnalytics(supabase: Supabase) {
  const today = todayInManila();
  const year = today.slice(0, 4);
  const yearStart = manilaDayStart(`${year}-01-01`);

  const [requests, history, feedback, designers] = await Promise.all([
    readAll((a, b) =>
      supabase
        .from("requests")
        .select(
          "id, status, created_at, date_completed, assigned_designer_id, is_deal, deal_size, team:teams(name), request_type:request_types(name)",
        )
        .gte("created_at", yearStart)
        .order("created_at")
        .range(a, b),
    ),
    readAll((a, b) =>
      supabase
        .from("activity_log")
        .select("request_id, to_value, created_at")
        .eq("action", "status")
        .gte("created_at", yearStart)
        .order("created_at")
        .range(a, b),
    ),
    readAll((a, b) =>
      supabase
        .from("feedback")
        .select("process_rating, output_rating, submitted_at, request:requests(assigned_designer_id, team:teams(is_marketing))")
        .gte("submitted_at", yearStart)
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
  const everAccepted = (r: (typeof requests)[number]) =>
    ACCEPTED.has(r.status) || (changes.get(r.id) ?? []).some((c) => ACCEPTED.has(c.status));
  // A request's status at a moment: its last change before then.
  const statusAt = (id: string, moment: string) => {
    let status = "new_request";
    for (const c of changes.get(id) ?? []) if (c.at < moment) status = c.status;
    return status;
  };

  const counted = feedback.filter((f) => !one(f.request)?.team?.is_marketing);
  const overall = (list: typeof counted) => {
    const p = average(list.map((f) => f.process_rating));
    const o = average(list.map((f) => f.output_rating));
    return p === null || o === null ? null : (p + o) / 2;
  };

  // January to the current month.
  const lastMonth = Number(today.slice(5, 7));
  const months: MonthRow[] = [];
  for (let m = 1; m <= lastMonth; m++) {
    const month = `${year}-${String(m).padStart(2, "0")}`;
    const start = manilaDayStart(`${month}-01`);
    const end = manilaDayStart(format(addMonths(parseISO(`${month}-01`), 1), "yyyy-MM-dd"));
    const inMonth = (ts: string | null) => !!ts && ts >= start && ts < end;
    const filed = requests.filter((r) => inMonth(r.created_at));
    const done = requests.filter((r) => r.status === "completed" && inMonth(r.date_completed));
    const monthFeedback = counted.filter((f) => inMonth(f.submitted_at));
    const deals = filed.filter((r) => r.is_deal);
    months.push({
      month,
      label: format(parseISO(`${month}-01`), "MMMM"),
      requestsIn: filed.length,
      accepted: filed.filter(everAccepted).length,
      completed: done.length,
      // For the current month, "month-end" means now.
      openAtMonthEnd: requests.filter((r) => r.created_at < end && OPEN_AT_MONTH_END.has(statusAt(r.id, end))).length,
      avgTurnaround: average(done.map((r) => workingDays(r.created_at, r.date_completed!))),
      dealRequests: deals.length,
      dealSize: deals.reduce((n, r) => n + (r.deal_size ?? 0), 0),
      feedbackRating: overall(monthFeedback),
      feedbackCount: monthFeedback.length,
    });
  }

  const shares = (key: (r: (typeof requests)[number]) => string, list = requests): Share[] => {
    const m = new Map<string, number>();
    for (const r of list) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };

  const designerRows: DesignerRow[] = (designers.data ?? [])
    .map((d) => {
      const mine = requests.filter((r) => r.assigned_designer_id === d.id);
      const done = mine.filter((r) => r.status === "completed" && r.date_completed);
      return {
        // Two designers can share a first name; former ones are marked.
        name: d.active ? d.display_name : `${d.display_name} (former)`,
        active: d.active,
        handled: mine.length,
        completed: done.length,
        avgTurnaround: average(done.map((r) => workingDays(r.created_at, r.date_completed!))),
        feedbackRating: overall(counted.filter((f) => one(f.request)?.assigned_designer_id === d.id)),
        completedByMonth: months.map((m) => done.filter((r) => manilaDay(r.date_completed!).startsWith(m.month)).length),
      };
    })
    .filter((d) => d.active || d.handled > 0);

  // Deals by type of request: how many deal requests, and their deal size.
  const dealRequests = requests.filter((r) => r.is_deal);
  const dealTypes = new Map<string, { label: string; requests: number; size: number }>();
  for (const r of dealRequests) {
    const label = r.request_type?.name ?? "—";
    const t = dealTypes.get(label) ?? { label, requests: 0, size: 0 };
    t.requests += 1;
    t.size += r.deal_size ?? 0;
    dealTypes.set(label, t);
  }

  const done = requests.filter((r) => r.status === "completed" && r.date_completed);
  return {
    year,
    months,
    totals: {
      requestsIn: requests.length,
      accepted: requests.filter(everAccepted).length,
      completed: done.length,
      avgTurnaround: average(done.map((r) => workingDays(r.created_at, r.date_completed!))),
      feedbackRating: overall(counted),
      feedbackCount: counted.length,
      dealRequests: dealRequests.length,
      dealSize: dealRequests.reduce((n, r) => n + (r.deal_size ?? 0), 0),
    },
    byTeam: shares((r) => r.team?.name ?? "—"),
    byType: shares((r) => r.request_type?.name ?? "—"),
    designers: designerRows,
    dealTypes: [...dealTypes.values()].sort((a, b) => b.size - a.size || b.requests - a.requests),
  };
}

export type Analytics = Awaited<ReturnType<typeof loadAnalytics>>;
