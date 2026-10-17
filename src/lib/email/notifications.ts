import "server-only";
import { N1NewRequest, n1Subject } from "@/emails/N1NewRequest";
import { N8FinalOutput, n8Subject } from "@/emails/N8FinalOutput";
import { formatDate } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "./send";

// Builds and sends each notification. Called after the change is saved
// (via next/server `after`), so emails never slow down or block a save.

async function loadRequest(requestId: string) {
  const { data, error } = await createAdminClient()
    .from("requests")
    .select("id, request_code, title, status, requester_name, requester_email, date_needed, link_to_output, team:teams(name), designer:designers(display_name)")
    .eq("id", requestId)
    .single();
  if (error) throw new Error(`Request ${requestId} not found: ${error.message}`);
  return data;
}

// N1 — Lead Designers + members ticked "Gets team emails" (e.g. Riann).
export async function notifyNewRequest(requestId: string, appUrl: string) {
  try {
    const request = await loadRequest(requestId);
    const { data: members, error } = await createAdminClient()
      .from("team_members")
      .select("email")
      .or("roles.cs.{lead_designer},gets_team_emails.eq.true");
    if (error) throw new Error(`Could not load the team: ${error.message}`);
    const to = (members ?? []).map((m) => m.email);

    await sendEmail({
      key: "N1_NEW_REQUEST",
      requestId,
      to,
      subject: n1Subject(request.title),
      email: N1NewRequest({
        title: request.title,
        code: request.request_code,
        requesterName: request.requester_name,
        team: request.team?.name ?? "—",
        dateNeeded: formatDate(request.date_needed),
        url: `${appUrl}/admin/requests/${request.request_code}`,
        status: request.status,
      }),
    });
  } catch (e) {
    console.error("[email N1] failed", e);
  }
}

// N8 — the requester, once, when the request first becomes Completed.
export async function notifyFinalOutput(requestId: string, appUrl: string) {
  try {
    const request = await loadRequest(requestId);
    const link = request.link_to_output && /^https?:\/\/\S+$/.test(request.link_to_output) ? request.link_to_output : null;

    await sendEmail({
      key: "N8_FINAL_OUTPUT",
      requestId,
      to: [request.requester_email],
      subject: n8Subject(request.title),
      email: N8FinalOutput({
        title: request.title,
        code: request.request_code,
        designerName: request.designer?.display_name ?? "the Marketing Design team",
        outputUrl: link,
        buttonUrl: link ?? `${appUrl}/my-requests/${request.request_code}`,
        feedbackUrl: `${appUrl}/feedback/${request.request_code}`,
      }),
    });
  } catch (e) {
    console.error("[email N8] failed", e);
  }
}
