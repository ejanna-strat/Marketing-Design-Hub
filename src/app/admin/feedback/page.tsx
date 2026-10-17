import Link from "next/link";
import { StarsDisplay } from "@/components/feedback/Stars";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth";
import { formatDate, manilaDayStart, todayInManila } from "@/lib/dates";
import { formatRating, one, overallRating } from "@/lib/feedback";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Feedback" };

// §7.2 #3: feedback received this year. Averages leave out requesters whose
// team is Marketing (CLAUDE.md §2); their feedback is still listed.
export default async function FeedbackPage() {
  await requireStaff();
  const supabase = await createClient();
  const year = todayInManila().slice(0, 4);
  const yearStart = manilaDayStart(`${year}-01-01`);

  const [{ data: rows, error }, { data: completed }] = await Promise.all([
    supabase
      .from("feedback")
      .select(
        "id, process_rating, output_rating, comments, submitted_at, request:requests(request_code, title, requester_name, team:teams(name, is_marketing), designer:designers(display_name))",
      )
      .gte("submitted_at", yearStart)
      .order("submitted_at", { ascending: false }),
    supabase
      .from("requests")
      .select("id, team:teams(is_marketing), feedback(id)")
      .eq("status", "completed")
      .gte("date_completed", yearStart),
  ]);
  if (error) throw new Error(error.message);

  const all = (rows ?? []).map((f) => ({ ...f, request: one(f.request) }));
  const counted = all.filter((f) => !f.request?.team?.is_marketing);
  const avg = (pick: (f: (typeof counted)[number]) => number) =>
    counted.length ? counted.reduce((sum, f) => sum + pick(f), 0) / counted.length : 0;
  const processAvg = avg((f) => f.process_rating);
  const outputAvg = avg((f) => f.output_rating);
  const overall = (processAvg + outputAvg) / 2;

  const completedCounted = (completed ?? []).filter((r) => !r.team?.is_marketing);
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
                  No feedback yet this year.
                </TableCell>
              </TableRow>
            ) : (
              all.map((f) => (
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
