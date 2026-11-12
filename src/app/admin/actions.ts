"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getAppUrl } from "@/lib/app-url";
import { duplicateOf, isOutputLink, LINK_LABEL_MAX, OUTPUT_LINK_ERROR } from "@/lib/links";
import { getCurrentUser } from "@/lib/auth";
import {
  notifyAssigned,
  notifyDesignerAccepted,
  notifyFinalOutput,
  notifyForReview,
  notifyReassigned,
  notifyReturned,
} from "@/lib/email/notifications";
import { buildAnswersSchema, QUESTION_COLUMNS, toAnswersPayload, toFormQuestion } from "@/lib/requests/schema";
import { ADMIN_STATUSES, holdOrCancelOnly } from "@/lib/statuses";
import { Constants } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };
// updateRequest also returns the saved status (it can change automatically).
type UpdateResult = { ok: true; status?: string } | { ok: false; error: string };

const outputLink = z
  .string()
  .trim()
  .max(2000, "Please keep the link under 2,000 characters.")
  .refine((v) => !v || isOutputLink(v), OUTPUT_LINK_ERROR)
  .transform((v) => v || null)
  .nullable();
const linkLabel = z
  .string()
  .trim()
  .max(LINK_LABEL_MAX, `Please keep link names under ${LINK_LABEL_MAX} characters.`)
  .transform((v) => v || null)
  .nullable();

const patchSchema = z
  .object({
    status: z.enum(Constants.public.Enums.request_status),
    link_to_output: outputLink,
    link_to_output_2: outputLink,
    link_to_output_3: outputLink,
    link_label_1: linkLabel,
    link_label_2: linkLabel,
    link_label_3: linkLabel,
    date_needed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a valid date."),
    title: z.string().trim().min(1, "Please enter a request title.").max(200, "Please keep the title under 200 characters."),
    project_overview: z
      .string()
      .trim()
      .min(1, "Please answer: Project Overview and Objective")
      .max(5000, "Please keep the Project Overview and Objective under 5,000 characters."),
    requester_name: z.string().trim().min(1, "Please enter the requester's name.").max(200),
    team_id: z.uuid("Please choose a business unit."),
    final_approver_name: z.string().trim().min(1, "Please enter the approver's name.").max(200),
    final_approver_email: z.email("Please enter a valid approver email.").trim().toLowerCase(),
    is_deal: z.boolean(),
    deal_name: z.string().trim().min(1, "Please enter the deal name.").max(200).nullable(),
    deal_size: z.number().int("Please enter the deal size in whole pesos.").min(0).max(999999999999999).nullable(),
  })
  .partial()
  .strict();

export type RequestPatch = z.input<typeof patchSchema>;

// Changes pipeline fields and General Information on one request. Every
// Marketing team member can, except that a designer on the request who hasn't
// accepted yet can't change the status or links (owner, Nov 12). Designers
// are changed with setDesigners / addMeAsDesigner / respondAsDesigner.
// The database enforces the same rules (RLS + column guard) and writes the
// activity log.
export async function updateRequest(requestId: string, patch: RequestPatch): Promise<UpdateResult> {
  const user = await getCurrentUser();
  if (!user?.isStaff) return { ok: false, error: "Only the Marketing team can change requests." };
  if (!z.uuid().safeParse(requestId).success) return { ok: false, error: "Request not found." };

  const parsed = patchSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your changes." };
  const changes = parsed.data;
  // The links editor saves all three: filled ones move up so Link 1 is never
  // empty while there are others (a name without a link is dropped).
  if ("link_to_output_2" in changes) {
    const filled = [
      [changes.link_to_output, changes.link_label_1],
      [changes.link_to_output_2, changes.link_label_2],
      [changes.link_to_output_3, changes.link_label_3],
    ].filter(([url]) => url);
    if (duplicateOf(filled.map(([url]) => url ?? "")).some((j) => j >= 0)) {
      return { ok: false, error: "The same link is added twice. Please remove one." };
    }
    if (filled.length >= 2 && filled.some(([, label]) => !label)) {
      return { ok: false, error: "Please give each link a name when there are 2 or more." };
    }
    [changes.link_to_output, changes.link_label_1] = filled[0] ?? [null, null];
    [changes.link_to_output_2, changes.link_label_2] = filled[1] ?? [null, null];
    [changes.link_to_output_3, changes.link_label_3] = filled[2] ?? [null, null];
  }
  const fields = Object.keys(changes);
  if (fields.length === 0) return { ok: true };
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("requests")
    .select("status, request_designers(designer_id, response)")
    .eq("id", requestId)
    .maybeSingle();
  if (!before) return { ok: false, error: "Request not found." };
  // Admins who don't design: On hold only here (Cancel has its own note
  // pop-up) (owner, Oct 30).
  const newStatus = changes.status;
  if (holdOrCancelOnly(user) && newStatus && newStatus !== before.status && !ADMIN_STATUSES.has(newStatus)) {
    return {
      ok: false,
      error: "Admins can put a request On hold or cancel it; the designer changes the other statuses.",
    };
  }
  const touchesWork = fields.some((f) => f === "status" || f.startsWith("link_"));
  const mine = before.request_designers.find((d) => d.designer_id === user.designerId);
  if (!user.isManager && touchesWork && mine?.response === "pending") {
    return { ok: false, error: "Please accept the request first; then you can change its status and links." };
  }

  const { data, error } = await supabase
    .from("requests")
    .update(changes)
    .eq("id", requestId)
    .select("id, request_code, status")
    .maybeSingle();
  if (error) {
    console.error("updateRequest failed", error);
    return { ok: false, error: error.code === "42501" ? error.message : "We couldn't save the change. Please try again." };
  }
  if (!data) return { ok: false, error: "You can't change this request." };

  // Emails (each once): N7 on For requester's review, N8 on Completed.
  const appUrl = await getAppUrl();
  if (data.status === "for_review" && before.status !== "for_review") after(() => notifyForReview(data.id, appUrl));
  if (data.status === "completed" && before.status !== "completed") after(() => notifyFinalOutput(data.id, appUrl));

  revalidatePath("/admin/pipeline");
  revalidatePath(`/admin/requests/${data.request_code}`);
  return { ok: true, status: data.status };
}

// Saves a request's specification answers (any Marketing team member). The
// database re-checks them like a new submission and updates Output Needed.
export async function updateSpecifications(requestId: string, answers: unknown): Promise<Result> {
  const user = await getCurrentUser();
  if (!user?.isStaff) return { ok: false, error: "Only the Marketing team can change requests." };
  if (!z.uuid().safeParse(requestId).success) return { ok: false, error: "Request not found." };

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("requests")
    .select("id, request_code, request_type_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return { ok: false, error: "Request not found." };

  const { data: rows } = await supabase
    .from("form_questions")
    .select(QUESTION_COLUMNS)
    .eq("request_type_id", request.request_type_id)
    .eq("active", true)
    .order("sort_order");
  const questions = (rows ?? []).map(toFormQuestion);
  const parsed = buildAnswersSchema(questions).safeParse({ answers });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the answers." };

  const { error } = await supabase.rpc("update_request_specs", {
    p_request_id: request.id,
    p_answers: toAnswersPayload(parsed.data.answers, questions),
  });
  if (error) {
    console.error("update_request_specs failed", error);
    return {
      ok: false,
      error: error.code === "P0001" || error.code === "42501" ? error.message : "We couldn't save the changes. Please try again.",
    };
  }
  revalidatePath("/admin/pipeline");
  revalidatePath(`/admin/requests/${request.request_code}`);
  return { ok: true };
}

function rpcError(error: { code?: string; message: string }, fallback: string) {
  console.error(fallback, error);
  return error.code === "P0001" || error.code === "42501" ? error.message : fallback;
}

// Reviewer (Super Admin / Lead Designer): return a new request with a reason.
export async function returnRequest(requestId: string, reason: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user?.isManager) return { ok: false, error: "Only Super Admins and Lead Designers can return requests." };
  if (!reason.trim()) return { ok: false, error: "Please give the reason for returning the request." };
  if (reason.length > 2000) return { ok: false, error: "Please keep the reason under 2,000 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("return_request", { p_request_id: requestId, p_reason: reason });
  if (error) return { ok: false, error: rpcError(error, "We couldn't return the request. Please try again.") };
  const appUrl = await getAppUrl();
  after(() => notifyReturned(requestId, appUrl));
  revalidatePath("/admin", "layout");
  revalidatePath(`/my-requests/${(data as { request_code: string }).request_code}`);
  return { ok: true };
}

// Marketing team: cancel a request with a note (owner, Oct 22). Nobody is
// emailed; the requester sees the note on their request page.
export async function cancelRequest(requestId: string, note: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user?.isStaff) return { ok: false, error: "Only the Marketing team can cancel requests here." };
  if (!note.trim()) return { ok: false, error: "Please add a note on why the request is cancelled." };
  if (note.length > 1000) return { ok: false, error: "Please keep the note under 1,000 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_request", { p_request_id: requestId, p_reason: note });
  if (error) return { ok: false, error: rpcError(error, "We couldn't cancel the request. Please try again.") };
  revalidatePath("/admin", "layout");
  revalidatePath(`/my-requests/${(data as { request_code: string }).request_code}`);
  return { ok: true };
}

// What the designer functions return (0033_multiple_designers.sql).
type DesignerChange = {
  id: string;
  request_code: string;
  status: string;
  // Designers added by someone else: they get the assigned email.
  added?: string[];
  // The first acceptance on the request → the requester's "Accepted" email.
  first_accepted?: string | null;
  // The first new designer after the whole team was replaced → "Reassigned".
  team_changed?: string | null;
  // add_me_as_designer: a fresh request taken (not "Add me").
  took?: boolean;
};

// Emails after a designer change (owner, Nov 12): N3 to each designer added
// by someone else; the requester's Accepted email the first time anyone
// accepts (not to someone who takes their own request); Reassigned when the
// first new designer accepts after the whole team was replaced.
async function designerEmails(change: DesignerChange, user: { id: string; email: string }) {
  const appUrl = await getAppUrl();
  for (const id of change.added ?? []) after(() => notifyAssigned(change.id, id, appUrl));
  if (change.first_accepted) {
    const designerId = change.first_accepted;
    const supabase = await createClient();
    const { data } = await supabase.from("requests").select("requester_id").eq("id", change.id).maybeSingle();
    const own = data?.requester_id === user.id;
    after(() => notifyDesignerAccepted(change.id, designerId, appUrl, own ? user.email : undefined));
  }
  if (change.team_changed) {
    const designerId = change.team_changed;
    after(() => notifyReassigned(change.id, designerId, appUrl));
  }
}

function revalidateRequest(code: string) {
  revalidatePath("/admin", "layout");
  revalidatePath(`/my-requests/${code}`);
}

// Super Admins and Lead Designers: the request's designers become exactly
// `designerIds` (owner, Nov 12: several, all equal). Adding yourself counts
// as accepted; others are asked to accept.
export async function setDesigners(requestId: string, designerIds: string[]): Promise<UpdateResult> {
  const user = await getCurrentUser();
  if (!user?.isManager) {
    return { ok: false, error: "Only Super Admins and Lead Designers can add or remove designers." };
  }
  const ids = z.array(z.uuid()).max(100).safeParse(designerIds);
  if (!z.uuid().safeParse(requestId).success || !ids.success) return { ok: false, error: "Request not found." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_request_designers", {
    p_request_id: requestId,
    p_designer_ids: ids.data,
  });
  if (error) return { ok: false, error: rpcError(error, "We couldn't save the designers. Please try again.") };
  const change = data as DesignerChange;
  await designerEmails(change, user);
  revalidateRequest(change.request_code);
  return { ok: true, status: change.status };
}

// Anyone in the Designer list: Take this request (no designer yet; the
// requester is told) or Add me as a designer (owner, Nov 12: no emails).
// Both count as accepted.
export async function addMeAsDesigner(requestId: string): Promise<UpdateResult> {
  const user = await getCurrentUser();
  if (!user?.designerId) return { ok: false, error: "Only people in the Designer list can add themselves." };
  if (!z.uuid().safeParse(requestId).success) return { ok: false, error: "Request not found." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_me_as_designer", { p_request_id: requestId });
  if (error) return { ok: false, error: rpcError(error, "We couldn't add you. Please try again.") };
  // Take this request, or Add me as the request's first acceptance → the
  // requester's Accepted email (owner, Nov 12); otherwise nothing.
  await designerEmails(data as DesignerChange, user);
  const change = data as DesignerChange;
  revalidateRequest(change.request_code);
  return { ok: true, status: change.status };
}

// A designer on the request: accept the task, or ask to reassign with a
// reason (removes only you; owner, Nov 12).
export async function respondAsDesigner(
  requestId: string,
  accept: boolean,
  reason: { category: "Full plate" | "Other concerns"; note: string } | null,
): Promise<Result> {
  const user = await getCurrentUser();
  if (!user?.isDesigner) return { ok: false, error: "Only a designer on this request can respond." };
  let text = "";
  if (!accept) {
    if (!reason) return { ok: false, error: "Please choose a reason." };
    const note = reason.note.trim();
    if (reason.category === "Other concerns" && !note) return { ok: false, error: "Please describe your concern." };
    if (note.length > 2000) return { ok: false, error: "Please keep the note under 2,000 characters." };
    text = note ? `${reason.category}: ${note}` : reason.category;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("designer_respond", {
    p_request_id: requestId,
    p_accept: accept,
    p_reason: text,
  });
  if (error) return { ok: false, error: rpcError(error, "We couldn't save your response. Please try again.") };
  const change = data as DesignerChange;
  await designerEmails(change, user);
  revalidateRequest(change.request_code);
  return { ok: true };
}
