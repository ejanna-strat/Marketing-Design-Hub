import "server-only";
import { format } from "date-fns";
import { type Analytics, EMPTY_TURNAROUND, firstRequestDay, loadAnalytics } from "@/lib/analytics";
import { todayInManila } from "@/lib/dates";
import type { createClient } from "@/lib/supabase/server";

// Analytics → Download report and Hub settings → Archive (owner, Nov 24).
// A year that's been archived (its finished requests removed) keeps the report
// saved at that moment in `archived_years`, so Analytics' Month on Month and
// the report download still show it.

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

// Reports saved before the turnaround and review numbers (Nov 26) get them
// as empty, so pages show "—".
export function deserializeAnalytics(saved: unknown): Analytics {
  const s = saved as Omit<Analytics, "byStatus"> & { byStatus: [string, number][] };
  return {
    ...s,
    totals: { ...EMPTY_TURNAROUND, ...s.totals },
    months: s.months.map((m) => ({ ...EMPTY_TURNAROUND, ...m })),
    byStatus: new Map(s.byStatus),
  } as Analytics;
}

export async function archivedYears(supabase: Supabase): Promise<number[]> {
  const { data } = await supabase.from("archived_years").select("year").order("year", { ascending: false });
  return (data ?? []).map((r) => r.year);
}

export async function archivedReport(supabase: Supabase, year: number): Promise<Analytics | null> {
  const { data } = await supabase.from("archived_years").select("report").eq("year", year).maybeSingle();
  return data ? deserializeAnalytics(data.report) : null;
}

// A year's report (Month on Month): the saved one when that year was
// archived, else from the live data.
export async function loadReport(supabase: Supabase, year: number) {
  const archived = await archivedReport(supabase, year);
  if (archived) return { a: archived, archived: true };
  const { from, to } = yearRange(year, await firstRequestDay(supabase));
  return { a: await loadAnalytics(supabase, from, to, true), archived: false };
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
const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "");

// The summary report: totals, month by month (for a year), business units,
// types of request, turnaround per type and deals. No names or emails.
export function reportCsv(a: Analytics, period: string, opts: { byMonth: boolean }) {
  const t = a.totals;
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
    ["Average turnaround to the 1st draft (working days)", avgDays(t.avgFirstDraft)],
    ["Average turnaround to completed (working days)", avgDays(t.avgTurnaround)],
    ["1st drafts sent on time", pct(t.firstOnTime, t.firstOnTimeOf)],
    ["Completed by the Final Deadline", pct(t.finalOnTime, t.finalOnTimeOf)],
    ["Review: 1st draft to completed (working days)", avgDays(t.avgReviewDays)],
    ["Review: waiting on the requester (working days)", avgDays(t.avgRequesterDays)],
    ["Review: with the designer (working days)", avgDays(t.avgDesignerDays)],
    ["Review rounds per request", avgDays(t.avgRounds)],
    ["Finished at 1st draft / V2 / V3", t.finishedAt.join(" / ")],
    ["Deal requests", t.dealRequests],
    ["Total deal size (PHP)", t.dealSize],
    ["Feedback overall (out of 5)", rating(t.feedbackRating)],
    ["Feedback: process (out of 5)", rating(t.feedbackProcess)],
    ["Feedback: output (out of 5)", rating(t.feedbackOutput)],
    ["Feedback responses", t.feedbackCount],
  ];

  if (opts.byMonth) {
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
        "Avg. to 1st draft (days)",
        "1st drafts on time",
        "Completed on time",
        "Avg. review rounds",
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
        avgDays(m.avgFirstDraft),
        pct(m.firstOnTime, m.firstOnTimeOf),
        pct(m.finalOnTime, m.finalOnTimeOf),
        avgDays(m.avgRounds),
        m.dealRequests,
        m.dealSize,
        rating(m.feedbackRating),
        m.feedbackCount,
      ]),
    );
  }

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
  return toCsv(rows);
}
