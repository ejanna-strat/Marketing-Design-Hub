import Link from "next/link";
import { DataTableToolbar } from "@/components/data-table/DataTableToolbar";
import { Pagination } from "@/components/data-table/Pagination";
import { StarsDisplay } from "@/components/feedback/Stars";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth";
import { formatDate, manilaDayStart, todayInManila } from "@/lib/dates";
import { formatRating, one, overallRating } from "@/lib/feedback";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Feedback" };

const STARS = ["1", "2", "3", "4", "5"].map((v) => ({ value: v, label: `${v} ★` }));
const HALF_STARS = ["1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5"].map((v) => ({ value: v, label: `${v} ★` }));

// §7.2 #3: feedback received this year. Averages leave out requesters whose
// team is Marketing (CLAUDE.md §2); their feedback is still listed.
// Filters (owner, Oct 18): team, designer, and exact Process / Output /
// Overall stars; the averages and response rate follow the filters.
export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const f1 = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  // Tick-box filters: several values each, comma-separated in the URL.
  const fs = (k: string) => f1(k).split(",").filter(Boolean);
  const filter = { team: fs("team"), designer: fs("designer"), process: fs("process").map(Number), output: fs("output").map(Number), overall: fs("overall").map(Number) };
  const size = [10, 25, 50, 100].includes(Number(f1("size"))) ? Number(f1("size")) : 25;
  const page = Math.max(1, Number.parseInt(f1("page"), 10) || 1);
  const supabase = await createClient();
  const year = todayInManila().slice(0, 4);
  const yearStart = manilaDayStart(`${year}-01-01`);

  const [{ data: rows, error }, { data: completed }, { data: teams }, { data: designers }] = await Promise.all([
    supabase
      .from("feedback")
      .select(
        "id, process_rating, output_rating, comments, submitted_at, request:requests(request_code, title, requester_name, team_id, assigned_designer_id, team:teams(name, is_marketing), designer:designers(display_name))",
      )
      .gte("submitted_at", yearStart)
      .order("submitted_at", { ascending: false }),
    supabase
      .from("requests")
      .select("id, team_id, assigned_designer_id, team:teams(is_marketing), feedback(id)")
      .eq("status", "completed")
      .gte("date_completed", yearStart),
    supabase.from("teams").select("id, name").order("sort_order"),
    supabase.from("designers").select("id, display_name").order("display_name"),
  ]);
  if (error) throw new Error(error.message);

  const byTeamDesigner = (r: { team_id: string; assigned_designer_id: string | null } | null) =>
    (!filter.team.length || filter.team.includes(r?.team_id ?? "")) &&
    (!filter.designer.length || filter.designer.includes(r?.assigned_designer_id ?? ""));
  const all = (rows ?? [])
    .map((f) => ({ ...f, request: one(f.request) }))
    .filter(
      (f) =>
        byTeamDesigner(f.request) &&
        (!filter.process.length || filter.process.includes(f.process_rating)) &&
        (!filter.output.length || filter.output.includes(f.output_rating)) &&
        (!filter.overall.length || filter.overall.includes(overallRating(f))),
    );
  const counted = all.filter((f) => !f.request?.team?.is_marketing);
  const avg = (pick: (f: (typeof counted)[number]) => number) =>
    counted.length ? counted.reduce((sum, f) => sum + pick(f), 0) / counted.length : 0;
  const processAvg = avg((f) => f.process_rating);
  const outputAvg = avg((f) => f.output_rating);
  const overall = (processAvg + outputAvg) / 2;

  const completedCounted = (completed ?? []).filter((r) => !r.team?.is_marketing && byTeamDesigner(r));
  const withFeedback = completedCounted.filter((r) => one(r.feedback)).length;
  const responseRate = completedCounted.length ? Math.round((withFeedback / completedCounted.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Feedback</h1>
        <p className="text-muted-foreground">
          {all.length} total feedback received ({year} year to date)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Process Average" value={counted.length ? <StarsDisplay value={processAvg} size="md" /> : "—"} />
        <Stat title="Output Average" value={counted.length ? <StarsDisplay value={outputAvg} size="md" /> : "—"} />
        <Stat title="Overall rating" value={counted.length ? <StarsDisplay value={overall} size="md" /> : "—"} />
        <Stat
          title="Completed requests with feedback"
          value={completedCounted.length ? `${responseRate}%` : "—"}
          note={`${withFeedback} of ${completedCounted.length} completed this year`}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Averages and the response rate leave out requesters from the Marketing team ({all.length - counted.length} of{" "}
        {all.length} responses).
      </p>

      <DataTableToolbar
        showSearch={false}
        showDates={false}
        filters={[
          { key: "team", label: "Team", options: (teams ?? []).map((t) => ({ value: t.id, label: t.name })) },
          { key: "designer", label: "Designer", options: (designers ?? []).map((d) => ({ value: d.id, label: d.display_name })) },
          { key: "process", label: "Process", options: STARS },
          { key: "output", label: "Output", options: STARS },
          { key: "overall", label: "Overall", options: HALF_STARS },
        ]}
      />

      <div className="overflow-hidden rounded-xl border bg-background">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              {["Request ID", "Request Title", "Requester", "Team", "Designer", "Process", "Output", "Overall", "Comments", "Date"].map(
                (h) => (
                  <TableHead key={h} className="text-xs font-semibold">
                    {h}
                  </TableHead>
                ),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {all.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                  No feedback matches these filters.
                </TableCell>
              </TableRow>
            ) : (
              all.slice((page - 1) * size, page * size).map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="align-top">
                    {f.request && (
                      <Link href={`/admin/requests/${f.request.request_code}`} className="font-mono font-medium text-brand hover:underline">
                        {f.request.request_code}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="min-w-48 align-top whitespace-normal">{f.request?.title}</TableCell>
                  <TableCell className="align-top">{f.request?.requester_name}</TableCell>
                  <TableCell className="align-top">
                    {f.request?.team?.name}
                    {f.request?.team?.is_marketing && <span className="block text-xs text-muted-foreground">not in averages</span>}
                  </TableCell>
                  <TableCell className="align-top">{f.request?.designer?.display_name ?? "—"}</TableCell>
                  <TableCell className="align-top">{f.process_rating}</TableCell>
                  <TableCell className="align-top">{f.output_rating}</TableCell>
                  <TableCell className="align-top font-medium">{formatRating(overallRating(f))} ⭐</TableCell>
                  <TableCell className="max-w-80 min-w-56 align-top whitespace-normal text-muted-foreground">
                    {f.comments ?? "—"}
                  </TableCell>
                  <TableCell className="align-top">{formatDate(f.submitted_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination total={all.length} page={page} pageSize={size} />
    </div>
  );
}

function Stat({ title, value, note }: { title: string; value: React.ReactNode; note?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-xl">{value}</CardTitle>
      </CardHeader>
      {note && (
        <CardContent>
          <p className="text-xs text-muted-foreground">{note}</p>
        </CardContent>
      )}
    </Card>
  );
}
