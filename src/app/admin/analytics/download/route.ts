import { endOfMonth, format, parseISO } from "date-fns";
import { NextResponse } from "next/server";
import { loadAnalytics } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, todayInManila } from "@/lib/dates";
import { archivedYears, csvResponse, loadReport, reportCsv } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";

// Analytics → Download report (owner, Nov 24): the period on screen as a CSV
// (opens in Excel or Google Sheets). Month on Month: ?tab=mom&year=; Monthly
// report: ?from=&to= (a month or a custom range). Marketing team only; no
// names or emails in it.
export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.isStaff)
    return NextResponse.json({ error: "Only the Marketing team can download reports." }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const supabase = await createClient();
  const today = todayInManila();

  if (params.get("tab") === "mom") {
    const year = Number(params.get("year"));
    if (!Number.isInteger(year) || year < 2026 || year > Number(today.slice(0, 4))) {
      return NextResponse.json({ error: "Please pick a year." }, { status: 400 });
    }
    const r = await loadReport(supabase, year);
    const body = reportCsv(r.a, `${year}, month by month${r.archived ? " (archived)" : ""}`, { byMonth: true });
    return csvResponse(body, `creative-hub-report-${year}.csv`);
  }

  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (!DAY.test(from) || !DAY.test(to) || from > to) {
    return NextResponse.json({ error: "Please pick a period." }, { status: 400 });
  }
  const archived = await archivedYears(supabase);
  if (archived.some((y) => from.startsWith(String(y)) || to.startsWith(String(y)))) {
    return NextResponse.json(
      { error: "That period is in an archived year. Download the year from Month on Month instead." },
      { status: 400 },
    );
  }
  const a = await loadAnalytics(supabase, from, to, false);
  const wholeMonth =
    from.endsWith("-01") &&
    from.slice(0, 7) === to.slice(0, 7) &&
    (to === format(endOfMonth(parseISO(from)), "yyyy-MM-dd") || to === today);
  const period = wholeMonth ? format(parseISO(from), "MMMM yyyy") : `${formatDate(from)} – ${formatDate(to)}`;
  const name = wholeMonth ? from.slice(0, 7) : `${from}_to_${to}`;
  return csvResponse(reportCsv(a, period, { byMonth: false }), `creative-hub-report-${name}.csv`);
}
