import "server-only";
import { endOfMonth, format, parseISO } from "date-fns";
import { type Analytics, firstRequestDay, loadAnalytics } from "@/lib/analytics";
import { todayInManila } from "@/lib/dates";
import type { createClient } from "@/lib/supabase/server";

// Settings → Reports (owner, Nov 24): the downloadable summary report and the
// yearly archive. A year that's been archived (its finished requests removed)
// keeps the report saved at that moment in `archived_years`, so Analytics'
// Month on Month and the report download still show it.

type Supabase = Awaited<ReturnType<typeof createClient>>;

// The Month on Month range for a year: from the app's first request (2026
// starts in October), to Dec 31 or today.
export function yearRange(year: number, first: string | null) {
  const today = todayInManila();
  const y = String(year);
  const from = first && y === first.slice(0, 4) ? `${first.slice(0, 7)}-01` : `${y}-01-01`;
  const to = y === today.slice(0, 4) ? today : `${y}-12-31`;
  return { from, to };
}

// Analytics holds one Map (byStatus); JSON keeps it as entries.
export function serializeAnalytics(a: Analytics) {
  return JSON.parse(JSON.stringify({ ...a, byStatus: [...a.byStatus.entries()] }));
}

export function deserializeAnalytics(saved: unknown): Analytics {
  const s = saved as Omit<Analytics, "byStatus"> & { byStatus: [string, number][] };
  return { ...s, byStatus: new Map(s.byStatus) } as Analytics;
}

export async function archivedYears(supabase: Supabase): Promise<number[]> {
  const { data } = await supabase.from("archived_years").select("year").order("year", { ascending: false });
  return (data ?? []).map((r) => r.year);
}

export async function archivedReport(supabase: Supabase, year: number): Promise<Analytics | null> {
  const { data } = await supabase.from("archived_years").select("report").eq("year", year).maybeSingle();
  return data ? deserializeAnalytics(data.report) : null;
}

// A year's or a month's report: from the saved archive when that year was
// archived (whole year only), else from the live data.
export async function loadReport(supabase: Supabase, year: number, month: number | null) {
  const archived = await archivedReport(supabase, year);
  if (archived) {
    if (month === null) return { a: archived, byMonth: true, archived: true };
    // One month of an archived year: its row from the saved month-by-month.
    return { a: archived, byMonth: true, archived: true, onlyMonth: `${year}-${String(month).padStart(2, "0")}` };
  }
  const first = await firstRequestDay(supabase);
  if (month === null) {
    const { from, to } = yearRange(year, first);
    return { a: await loadAnalytics(supabase, from, to, true), byMonth: true, archived: false };
  }
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = format(endOfMonth(parseISO(from)), "yyyy-MM-dd");
  const today = todayInManila();
  return {
    a: await loadAnalytics(supabase, from, last < today ? last : today, false),
    byMonth: false,
    archived: false,
  };
}

// ---- CSV ----

type Cell = string | number | null | undefined;

const cell = (v: Cell) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// A byte-order mark so Excel reads accents and ₱ correctly.
export function toCsv(rows: Cell[][]) {
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(body: string, filename: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

const rating = (v: number | null) => (v === null ? "" : v.toFixed(1));
const avgDays = (v: number | null) => (v === null ? "" : v.toFixed(1));

// The summary report: totals, month by month (for a year), business units,
// types of request, turnaround per type and deals. No names or emails.
export function reportCsv(a: Analytics, period: string, opts: { byMonth: boolean; onlyMonth?: string }) {
  const month = opts.onlyMonth ? a.months.find((m) => m.month === opts.onlyMonth) : null;
  const t = month ?? a.totals;
  const rows: Cell[][] = [
    ["Marketing Creative Hub report"],
    ["Period", period],
    ["Downloaded", format(new Date(), "MMM d, yyyy")],
    [],
    ["Summary", "Value"],
    ["Requests filed", t.requestsIn],
    ["Accepted by a designer", t.accepted],
    ["Completed", t.completed],
    ["Open at the end (accepted work)", t.openAcceptedAtEnd],
    ["Waiting for a designer at the end", t.waitingAtEnd],
    ["On hold at the end", t.onHoldAccepted],
    ["Returned", t.returned],
    ["Cancelled", t.cancelled],
    ["Average turnaround (working days)", avgDays(t.avgTurnaround)],
    ["Deal requests", t.dealRequests],
    ["Total deal size (PHP)", t.dealSize],
    ["Feedback overall (out of 5)", rating(t.feedbackRating)],
    ["Feedback: process (out of 5)", rating(t.feedbackProcess)],
    ["Feedback: output (out of 5)", rating(t.feedbackOutput)],
    ["Feedback responses", t.feedbackCount],
  ];

  if (opts.byMonth && !month) {
    rows.push(
      [],
      [
        "Month",
        "Requests filed",
        "Accepted",
        "Completed",
        "Open at month-end",
        "Waiting for a designer",
        "On hold",
        "Returned",
        "Cancelled",
        "Avg. turnaround (days)",
        "Deal requests",
        "Deal size (PHP)",
        "Feedback overall",
        "Feedback responses",
      ],
      ...a.months.map((m) => [
        `${m.label} ${m.month.slice(0, 4)}`,
        m.requestsIn,
        m.accepted,
        m.completed,
        m.openAcceptedAtEnd,
        m.waitingAtEnd,
        m.onHoldAccepted,
        m.returned,
        m.cancelled,
        avgDays(m.avgTurnaround),
        m.dealRequests,
        m.dealSize,
        rating(m.feedbackRating),
        m.feedbackCount,
      ]),
    );
  }

  // The breakdowns below cover the whole period (they aren't saved per month).
  if (!month) {
    rows.push([], ["Business unit", "Requests filed"], ...a.byTeam.map((s) => [s.label, s.value]));
    rows.push([], ["Type of request", "Requests filed"], ...a.byType.map((s) => [s.label, s.value]));
    rows.push(
      [],
      ["Type of request", "Completed", "Avg. turnaround (working days)"],
      ...a.typeTurnaround.map((x) => [x.label, x.completed, avgDays(x.avg)]),
    );
    rows.push(
      [],
      ["Deals by type of request", "Deal requests", "Deal size (PHP)"],
      ...a.dealTypes.map((d) => [d.label, d.requests, d.size]),
    );
  } else {
    rows.push([], ["Business unit, type and turnaround breakdowns are in the whole-year report for archived years."]);
  }
  return toCsv(rows);
}
