import { redirect } from "next/navigation";
import { DownloadIcon } from "lucide-react";
import { firstRequestDay } from "@/lib/analytics";
import { requireUser } from "@/lib/auth";
import { formatDate, formatDateTime, todayInManila } from "@/lib/dates";
import { archivedYears } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { RemoveYear } from "./RemoveYear";
import { ReportPicker } from "./ReportPicker";

// Settings → Reports (owner, Nov 24), for everyone on the Marketing team:
// 1. Download the summary report (no names or emails) for a year or a month.
// 2. Archive old requests: a year whose requests are all finished, the last
//    one at least 2 years ago. Download its requests (names replaced), then a
//    Super Admin removes them; the year's report is saved first.

type Status = {
  year: number;
  finished: number;
  open: number;
  available_from: string | null;
  archived: boolean;
  ready: boolean;
};

export default async function ReportsPage() {
  const user = await requireUser();
  if (!user.isStaff) redirect("/hubs");
  const supabase = await createClient();
  const [first, archived] = await Promise.all([firstRequestDay(supabase), archivedYears(supabase)]);
  const thisYear = Number(todayInManila().slice(0, 4));
  const firstYear = Math.min(first ? Number(first.slice(0, 4)) : thisYear, ...archived);
  const years: number[] = [];
  for (let y = thisYear; y >= firstYear; y--) years.push(y);

  const statuses = await Promise.all(
    years.map(async (y) => {
      const { data } = await supabase.rpc("archive_status", { p_year: y });
      return data as unknown as Status;
    }),
  );
  const { data: archivedRows } = await supabase
    .from("archived_years")
    .select("year, requests_removed, archived_at")
    .order("year", { ascending: false });
  const archivedInfo = new Map((archivedRows ?? []).map((r) => [r.year, r]));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Settings</p>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="max-w-2xl text-muted-foreground">
          Download Creative Hub reports, and archive old requests to keep the app light. Files open in Excel or Google
          Sheets.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border bg-background p-5">
        <div className="space-y-1">
          <h2 className="font-semibold">Download report</h2>
          <p className="text-sm text-muted-foreground">
            A summary of the Creative Hub for a year or a month: requests filed, accepted, completed and open, by
            business unit and type, turnaround, deals and feedback. No names or emails.
          </p>
        </div>
        <ReportPicker years={years} archived={archived} />
      </section>

      <section className="space-y-4 rounded-xl border bg-background p-5">
        <div className="space-y-1">
          <h2 className="font-semibold">Archive old requests</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            A year can be archived once every request filed that year is finished (Completed, Cancelled or Returned) and
            the last one finished at least 2 years ago. First download its requests: a pipeline-style list with names
            and emails replaced (&ldquo;Requester 1&rdquo;, &ldquo;Designer 1&rdquo;), without the request details. Then
            a Super Admin can remove them from the app. The year&apos;s report is saved first, so Analytics and the
            report above still show that year. Removing can&apos;t be undone.
          </p>
        </div>
        <ul className="divide-y rounded-lg border">
          {statuses.map((s) => {
            const info = archivedInfo.get(s.year);
            return (
              <li key={s.year} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="space-y-0.5">
                  <p className="font-medium">{s.year}</p>
                  <p className={cn("text-sm", s.ready ? "text-foreground" : "text-muted-foreground")}>
                    {info
                      ? `Archived ${formatDateTime(info.archived_at)}: ${info.requests_removed} requests removed. Its report is still available above.`
                      : s.ready
                        ? `Ready to archive: ${s.finished} finished ${s.finished === 1 ? "request" : "requests"}.`
                        : s.finished + s.open === 0
                          ? "No requests."
                          : s.open > 0
                            ? `${s.open} ${s.open === 1 ? "request is" : "requests are"} still open, so it can't be archived yet.${
                                s.available_from ? ` At the earliest: ${formatDate(s.available_from)}.` : ""
                              }`
                            : `Can be archived from ${formatDate(s.available_from)} (2 years after its last request finished).`}
                  </p>
                </div>
                {s.ready && !info && (
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/settings/reports/archive?year=${s.year}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-muted"
                    >
                      <DownloadIcon className="size-4" />
                      Download {s.finished} requests
                    </a>
                    {user.isSuperAdmin && <RemoveYear year={s.year} count={s.finished} />}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
