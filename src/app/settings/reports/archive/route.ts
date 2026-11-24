import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { outputLinks } from "@/lib/links";
import { sortDesigners } from "@/lib/requests/designers";
import { statusLabel } from "@/lib/statuses";
import { csvResponse, toCsv } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";

// Settings → Reports → Archive (owner, Nov 24): a year's finished requests
// (Completed, Cancelled, Returned) as a pipeline-style CSV, once the year can
// be archived. Names and emails are replaced ("Requester 1", "Approver 1",
// "Designer 1"; the same person keeps the same number). No specification
// answers, Project Overview or history. Each download is recorded: a Super
// Admin must download before removing the year's requests.
export const dynamic = "force-dynamic";

type Status = { ready: boolean; finished: number };

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.isStaff)
    return NextResponse.json({ error: "Only the Marketing team can download this." }, { status: 403 });
  const year = Number(new URL(request.url).searchParams.get("year"));
  if (!Number.isInteger(year) || year < 2026)
    return NextResponse.json({ error: "Please pick a year." }, { status: 400 });

  const supabase = await createClient();
  const { data: st, error: stError } = await supabase.rpc("archive_status", { p_year: year });
  if (stError) return NextResponse.json({ error: stError.message }, { status: 400 });
  const status = st as unknown as Status;
  if (!status.ready) return NextResponse.json({ error: `${year} can't be archived yet.` }, { status: 400 });

  // Manila calendar year.
  const { data, error } = await supabase
    .from("requests")
    .select(
      "request_code, created_at, date_needed, title, output_needed, status, requester_email, final_approver_email, date_started, date_completed, is_deal, deal_name, deal_size, link_to_output, link_to_output_2, link_to_output_3, link_label_1, link_label_2, link_label_3, request_type:request_types(name), team:teams(name), request_designers(designer_id, response, responded_at, added_at), feedback(process_rating, output_rating)",
    )
    .gte("created_at", `${year}-01-01T00:00:00+08:00`)
    .lt("created_at", `${year + 1}-01-01T00:00:00+08:00`)
    .in("status", ["completed", "cancelled", "rejected"])
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = data ?? [];

  const labeller = (prefix: string) => {
    const seen = new Map<string, string>();
    return (key: string | null | undefined) => {
      if (!key) return "";
      const k = key.trim().toLowerCase();
      if (!seen.has(k)) seen.set(k, `${prefix} ${seen.size + 1}`);
      return seen.get(k)!;
    };
  };
  const requester = labeller("Requester");
  const approver = labeller("Approver");
  const designer = labeller("Designer");

  const body = toCsv([
    [
      "Request ID",
      "Request date",
      "Date needed",
      "Request title",
      "Type of request",
      "Output needed",
      "Status",
      "Business unit",
      "Requester",
      "Final approver",
      "Designers",
      "Links to output",
      "Date started",
      "Date completed",
      "Feedback (overall)",
      "Feedback (process)",
      "Feedback (output)",
      "Deal",
      "Deal name",
      "Deal size (PHP)",
    ],
    ...rows.map((r) => {
      const fb = Array.isArray(r.feedback) ? r.feedback[0] : r.feedback;
      const sameApprover = r.final_approver_email?.trim().toLowerCase() === r.requester_email?.trim().toLowerCase();
      return [
        r.request_code,
        formatDate(r.created_at),
        formatDate(r.date_needed),
        r.title,
        r.request_type?.name ?? "",
        r.output_needed,
        statusLabel(r.status),
        r.team?.name ?? "",
        requester(r.requester_email),
        sameApprover ? "Same as requester" : approver(r.final_approver_email),
        sortDesigners(r.request_designers)
          .map((d) => designer(d.designer_id))
          .join(", "),
        outputLinks(r)
          .map((l) => `${l.label}: ${l.url}`)
          .join(" | "),
        r.date_started ? formatDate(r.date_started) : "",
        r.date_completed ? formatDate(r.date_completed) : "",
        fb ? ((fb.process_rating + fb.output_rating) / 2).toFixed(1) : "",
        fb?.process_rating ?? "",
        fb?.output_rating ?? "",
        r.is_deal ? "Yes" : "No",
        r.is_deal ? (r.deal_name ?? "") : "",
        r.is_deal ? (r.deal_size ?? "") : "",
      ];
    }),
  ]);

  await supabase.rpc("log_archive_export", { p_year: year, p_count: rows.length });
  return csvResponse(body, `creative-hub-requests-${year}-anonymized.csv`);
}
