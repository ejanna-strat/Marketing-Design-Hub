import { format, parseISO } from "date-fns";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { todayInManila } from "@/lib/dates";
import { csvResponse, loadReport, reportCsv } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";

// Settings → Reports: the summary report as a CSV (opens in Excel or Google
// Sheets), for a year or one month. Everyone on the Marketing team; no names
// or emails in it (owner, Nov 24).
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.isStaff)
    return NextResponse.json({ error: "Only the Marketing team can download reports." }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const year = Number(params.get("year"));
  const monthParam = params.get("month");
  const month = monthParam ? Number(monthParam) : null;
  const thisYear = Number(todayInManila().slice(0, 4));
  if (!Number.isInteger(year) || year < 2026 || year > thisYear) {
    return NextResponse.json({ error: "Please pick a year." }, { status: 400 });
  }
  if (month !== null && (!Number.isInteger(month) || month < 1 || month > 12)) {
    return NextResponse.json({ error: "Please pick a month." }, { status: 400 });
  }

  const supabase = await createClient();
  const r = await loadReport(supabase, year, month);
  const period =
    month === null
      ? `${year}, month by month`
      : format(parseISO(`${year}-${String(month).padStart(2, "0")}-01`), "MMMM yyyy");
  const body = reportCsv(r.a, period + (r.archived ? " (archived)" : ""), {
    byMonth: r.byMonth,
    onlyMonth: "onlyMonth" in r ? r.onlyMonth : undefined,
  });
  const name = month === null ? `${year}` : `${year}-${String(month).padStart(2, "0")}`;
  return csvResponse(body, `creative-hub-report-${name}.csv`);
}
