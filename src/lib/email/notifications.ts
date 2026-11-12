import "server-only";
import { TZDate } from "@date-fns/tz";
import { theme } from "@/config/theme";
import { N1NewRequest, n1Subject } from "@/emails/N1NewRequest";
import { N1Reminder, n1ReminderSubject } from "@/emails/N1Reminder";
import { N2Returned, n2Subject } from "@/emails/N2Returned";
import { N3Assigned, n3Subject } from "@/emails/N3Assigned";
import { N4Accepted, n4Subject } from "@/emails/N4Accepted";
import { N6Reassigned, n6Subject } from "@/emails/N6Reassigned";
import { N7ForReview, n7Subject } from "@/emails/N7ForReview";
import { N8FinalOutput, n8Subject } from "@/emails/N8FinalOutput";
import { N10DueSoon, n10Subject } from "@/emails/N10DueSoon";
import { N11Cancelled, n11Subject } from "@/emails/N11Cancelled";
import { N12FeedbackReceived, n12Subject } from "@/emails/N12FeedbackReceived";
import { addDays, format, parseISO } from "date-fns";
import { formatDate, todayInManila } from "@/lib/dates";
import { type OutputLinkFields, outputLinks } from "@/lib/links";
import { accepted, joinNames, type RequestDesigner, sortDesigners } from "@/lib/requests/designers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "./send";

// Builds and sends each notification. Called after the change is saved
// (via next/server `after`), so emails never slow down or block a save.

async function loadRequest(requestId: string) {
  const { data, error } = await createAdminClient()
    .from("requests")
    .select("id, request_code, title, status, requester_name, requester_email, date_needed, link_to_output, link_to_output_2, link_to_output_3, link_label_1, link_label_2, link_label_3, return_reason, returned_by, cancel_reason, team:teams(name), request_designers(designer_id, response, responded_at, added_at, designer:designers(display_name, email))")
    .eq("id", requestId)
    .single();
  if (error) throw new Error(`Request ${requestId} not found: ${error.message}`);
  return { ...data, request_designers: sortDesigners(data.request_designers) };
}

// A request has several designers (owner, Nov 12): their names for emails
// ("Sofia and Dasha") and their addresses. Emails to the requester name only
// designers who have accepted.
const namesOf = (rows: RequestDesigner[], fallback: string) =>
  joinNames(rows.map((d) => d.designer?.display_name).filter((n): n is string => !!n)) || fallback;
const emailsOf = (rows: RequestDesigner[]) =>
  rows.map((d) => d.designer?.email).filter((e): e is string => !!e);
const nameOf = (rows: RequestDesigner[], designerId: string) =>
  rows.find((d) => d.designer_id === designerId)?.designer?.display_name;

// N1 — Lead Designers + members ticked "Copy me on Lead Designer emails".
export async function notifyNewRequest(requestId: string, appUrl: string) {
  try {
    const request = await loadRequest(requestId);
    const { data: members, error } = await createAdminClient()
      .from("team_members")
      .select("email")
      .or("roles.cs.{lead_designer},copy_lead_emails.eq.true");
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
    const links = webLinks(request);

    await sendEmail({
      key: "N8_FINAL_OUTPUT",
      requestId,
      to: [request.requester_email],
      subject: n8Subject(request.title),
      email: N8FinalOutput({
        title: request.title,
        code: request.request_code,
        designerName: namesOf(accepted(request.request_designers), "the Marketing Design team"),
        outputLinks: links,
        buttonUrl: links[0]?.url ?? `${appUrl}/my-requests/${request.request_code}`,
        feedbackUrl: `${appUrl}/feedback/${request.request_code}`,
      }),
    });
  } catch (e) {
    console.error("[email N8] failed", e);
  }
}

// Lead Designers + members ticked "Copy me on Lead Designer emails".
async function leadEmailRecipients() {
  const { data, error } = await createAdminClient()
    .from("team_members")
    .select("email")
    .or("roles.cs.{lead_designer},copy_lead_emails.eq.true");
  if (error) throw new Error(`Could not load the team: ${error.message}`);
  return (data ?? []).map((m) => m.email);
}

// Members ticked "Copy me on requester emails" (owner, Oct 30).
async function requesterCopyRecipients() {
  const { data } = await createAdminClient().from("team_members").select("email").eq("copy_requester_emails", true);
  return (data ?? []).map((m) => m.email);
}

// The request's Links to Output that are web links (older ones may be text).
const webLinks = (r: OutputLinkFields) => outputLinks(r).filter((l) => /^https?:\/\/\S+$/.test(l.url));

// N2 — the requester, once, when a reviewer returns the request.
export async function notifyReturned(requestId: string, appUrl: string) {
  try {
    const r = await loadRequest(requestId);
    const { data: reviewer } = r.returned_by
      ? await createAdminClient().from("profiles").select("full_name, email").eq("id", r.returned_by).maybeSingle()
      : { data: null };
    await sendEmail({
      key: "N2_RETURNED",
      requestId,
      to: [r.requester_email],
      subject: n2Subject(r.title),
      email: N2Returned({
        title: r.title,
        code: r.request_code,
        reason: r.return_reason ?? "—",
        reviewerName: reviewer?.full_name || "the Marketing Design team",
        reviewerEmail: reviewer?.email ?? null,
        url: `${appUrl}/requests/new`,
      }),
    });
  } catch (e) {
    console.error("[email N2] failed", e);
  }
}

// N3 — each designer added by someone else (owner, Oct 30 / Nov 12), once per
// designer. Adding yourself sends nothing.
export async function notifyAssigned(requestId: string, designerId: string, appUrl: string) {
  try {
    const r = await loadRequest(requestId);
    const designer = r.request_designers.find((d) => d.designer_id === designerId)?.designer;
    if (!designer?.email) return;
    await sendEmail({
      key: `N3_ASSIGNED:${designerId}`,
      requestId,
      to: [designer.email],
      subject: n3Subject(),
      email: N3Assigned({
        title: r.title,
        code: r.request_code,
        requesterName: r.requester_name,
        team: r.team?.name ?? "—",
        dateNeeded: formatDate(r.date_needed),
        status: r.status,
        url: `${appUrl}/admin/pipeline?designer=${designerId}`,
      }),
    });
  } catch (e) {
    console.error("[email N3] failed", e);
  }
}

// N4 — the requester (+ "Copy me on requester emails"), once per request, the
// first time a designer accepts or takes it (owner, Nov 12; the database
// decides when: designer_respond / add_me_as_designer / set_request_designers
// return `first_accepted`). Names the designer who accepted. `skipEmail`: the
// person who took their own request doesn't get an email about it (owner,
// Oct 22).
export async function notifyDesignerAccepted(
  requestId: string,
  designerId: string,
  appUrl: string,
  skipEmail?: string,
) {
  try {
    const r = await loadRequest(requestId);
    const skip = skipEmail?.toLowerCase();
    const to = [r.requester_email, ...(await requesterCopyRecipients())].filter((e) => e.toLowerCase() !== skip);
    if (to.length === 0) return;
    await sendEmail({
      key: "N4_ACCEPTED",
      requestId,
      to,
      subject: n4Subject(r.title),
      email: N4Accepted({
        title: r.title,
        code: r.request_code,
        designerName: nameOf(r.request_designers, designerId) ?? "a designer",
        url: `${appUrl}/my-requests`,
      }),
    });
  } catch (e) {
    console.error("[email N4] failed", e);
  }
}

// N6 — the requester (+ "Copy me on requester emails", owner Oct 30) only when
// the whole team was replaced, sent when the first new designer accepts and
// naming them (owner, Nov 12). The database returns `team_changed` exactly
// once per replacement, so the same designer can be announced again after a
// later replacement.
export async function notifyReassigned(requestId: string, designerId: string, appUrl: string) {
  try {
    const r = await loadRequest(requestId);
    const name = nameOf(r.request_designers, designerId);
    if (!name) return;
    await sendEmail({
      key: `N6_REASSIGNED:${designerId}`,
      onceOnly: false,
      requestId,
      to: [r.requester_email, ...(await requesterCopyRecipients())],
      subject: n6Subject(r.title),
      email: N6Reassigned({
        title: r.title,
        code: r.request_code,
        designerName: name,
        status: r.status,
        url: `${appUrl}/my-requests`,
      }),
    });
  } catch (e) {
    console.error("[email N6] failed", e);
  }
}

// N7 — the requester, once, when the status becomes For requester's review.
export async function notifyForReview(requestId: string, appUrl: string) {
  try {
    const r = await loadRequest(requestId);
    await sendEmail({
      key: "N7_FOR_REVIEW",
      requestId,
      to: [r.requester_email],
      subject: n7Subject(r.title),
      email: N7ForReview({
        title: r.title,
        code: r.request_code,
        designerName: namesOf(accepted(r.request_designers), "the designer"),
        outputLinks: webLinks(r),
        url: `${appUrl}/my-requests/${r.request_code}`,
      }),
    });
  } catch (e) {
    console.error("[email N7] failed", e);
  }
}

// Statuses that still get the 3-day reminder. On hold, Cancelled, Returned
// and Completed don't (owner, Oct 21).
const REMIND_STATUSES = ["new_request", "designer_assigned", "in_progress", "for_review", "for_revision"] as const;

// N10 — run every weekday at 8AM (Manila) by Vercel Cron. Sends once per
// request and Date Needed to Lead Designers, "Copy me on Lead Designer
// emails" members (owner, Oct 30) + every designer on it (Nov 12), for requests due
// within the next 3 days (so weekends aren't skipped). A changed Date Needed
// gets its own reminder.
export async function sendDueReminders(appUrl: string) {
  const today = todayInManila();
  const until = format(addDays(parseISO(today), 3), "yyyy-MM-dd");
  const { data, error } = await createAdminClient()
    .from("requests")
    .select("id, request_code, title, status, requester_name, date_needed, team:teams(name), request_designers(designer:designers(email))")
    .in("status", [...REMIND_STATUSES])
    .gte("date_needed", today)
    .lte("date_needed", until);
  if (error) throw new Error(error.message);

  const results: Record<string, string> = {};
  if (!data?.length) return results;
  const leads = await leadEmailRecipients();
  for (const r of data) {
    results[r.request_code] = await sendEmail({
      key: `N10_DUE_SOON:${r.date_needed}`,
      requestId: r.id,
      to: [...leads, ...r.request_designers.map((d) => d.designer?.email).filter((e): e is string => !!e)],
      subject: n10Subject(),
      email: N10DueSoon({
        title: r.title,
        code: r.request_code,
        requesterName: r.requester_name,
        team: r.team?.name ?? "—",
        dateNeeded: formatDate(r.date_needed),
        status: r.status,
        url: `${appUrl}/admin/requests/${r.request_code}`,
      }),
    });
  }
  return results;
}

// To every designer on the request, once, when the requester cancels (owner,
// Oct 21 / Nov 12). Nobody is emailed when no designer was assigned yet.
export async function notifyCancelled(requestId: string, appUrl: string) {
  try {
    const r = await loadRequest(requestId);
    const to = emailsOf(r.request_designers);
    if (to.length === 0) return;
    await sendEmail({
      key: "N11_CANCELLED",
      requestId,
      to,
      subject: n11Subject(r.title),
      email: N11Cancelled({
        title: r.title,
        code: r.request_code,
        requesterName: r.requester_name,
        reason: r.cancel_reason ?? "—",
        url: `${appUrl}/admin/requests/${r.request_code}`,
      }),
    });
  } catch (e) {
    console.error("[email cancelled] failed", e);
  }
}

// New-request reminder — run every weekday at 8AM (Manila) with the deadline
// reminder. A New request with no designer gets its first reminder at the
// SECOND weekday 8AM check after it started waiting (filed, or its designer
// removed / asked to reassign) — e.g. filed Mon 10PM → Wed 8AM — then one
// every weekday until a designer is assigned. Goes to Lead Designers, "Copy
// me on Lead Designer emails" members and every designer, who can take it (owner, Oct 22).
export async function sendUnassignedReminders(appUrl: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("requests")
    .select("id, request_code, title, requester_name, date_needed, created_at, team:teams(name)")
    .eq("status", "new_request")
    .is("assigned_designer_id", null);
  if (error) throw new Error(error.message);
  const results: Record<string, string> = {};
  if (!data?.length) return results;

  // When each request last lost its designer, if ever.
  const { data: unassigned } = await db
    .from("activity_log")
    .select("request_id, created_at")
    .in("request_id", data.map((r) => r.id))
    .or("action.in.(reassign_requested,designer_removed),and(action.eq.designer,to_value.is.null)");
  const lastUnassigned = new Map<string, string>();
  for (const u of unassigned ?? []) {
    if (u.created_at > (lastUnassigned.get(u.request_id) ?? "")) lastUnassigned.set(u.request_id, u.created_at);
  }

  const [{ data: members, error: membersError }, { data: designers }] = await Promise.all([
    db.from("team_members").select("email").or("roles.cs.{lead_designer},copy_lead_emails.eq.true"),
    db.from("designers").select("email").eq("active", true),
  ]);
  if (membersError) throw new Error(membersError.message);
  const to = [...(members ?? []).map((m) => m.email), ...(designers ?? []).map((d) => d.email)];

  const now = Date.now();
  const today = todayInManila();
  for (const r of data) {
    const since = [r.created_at, lastUnassigned.get(r.id) ?? ""].sort().at(-1)!;
    if (today < secondCheckDay(since)) continue;
    const hours = (now - new Date(since).getTime()) / 36e5;
    results[r.request_code] = await sendEmail({
      // One per request per day.
      key: `N1_REMINDER:${today}`,
      requestId: r.id,
      to,
      subject: n1ReminderSubject(r.title),
      email: N1Reminder({
        title: r.title,
        code: r.request_code,
        requesterName: r.requester_name,
        team: r.team?.name ?? "—",
        dateNeeded: formatDate(r.date_needed),
        waitingSince: formatDate(since),
        days: Math.floor(hours / 24),
        url: `${appUrl}/admin/requests/${r.request_code}`,
      }),
    });
  }
  return results;
}

// The Manila date of the second weekday 8AM check after `since`: the first
// check after filing is skipped so every request gets at least one full
// working morning before anyone is reminded (owner, Oct 22).
export function secondCheckDay(since: string) {
  const start = new Date(since).getTime();
  let day = format(new TZDate(start, theme.timeZone), "yyyy-MM-dd");
  let found = 0;
  for (let i = 0; i < 14; i++) {
    const check = new TZDate(`${day}T08:00:00`, theme.timeZone);
    const weekday = check.getDay();
    if (weekday !== 0 && weekday !== 6 && check.getTime() > start) {
      found += 1;
      if (found === 2) return day;
    }
    day = format(addDays(parseISO(day), 1), "yyyy-MM-dd");
  }
  return day;
}

// New feedback — to Lead Designers, "Copy on Lead's email" members and every
// designer on the request, once per request (owner, Nov 6 / Nov 12). Feedback from Marketing
// team requesters is sent too, with a note that it isn't in the averages.
export async function notifyFeedback(requestCode: string, appUrl: string) {
  try {
    const { data: r, error } = await createAdminClient()
      .from("requests")
      .select(
        "id, request_code, title, requester_name, team:teams(name, is_marketing), request_designers(designer_id, response, responded_at, added_at, designer:designers(display_name, email)), feedback(process_rating, output_rating, comments)",
      )
      .eq("request_code", requestCode)
      .single();
    if (error) throw new Error(`Request ${requestCode} not found: ${error.message}`);
    const f = Array.isArray(r.feedback) ? r.feedback[0] : r.feedback;
    if (!f) return;
    await sendEmail({
      key: "N12_FEEDBACK",
      requestId: r.id,
      to: [...(await leadEmailRecipients()), ...emailsOf(r.request_designers)],
      subject: n12Subject(r.title),
      email: N12FeedbackReceived({
        title: r.title,
        code: r.request_code,
        requesterName: r.requester_name,
        team: r.team?.name ?? "—",
        designerName: namesOf(sortDesigners(r.request_designers), "—"),
        process: f.process_rating,
        output: f.output_rating,
        comments: f.comments,
        fromMarketing: !!r.team?.is_marketing,
        url: `${appUrl}/admin/requests/${r.request_code}`,
      }),
    });
  } catch (e) {
    console.error("[email feedback] failed", e);
  }
}
