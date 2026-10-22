"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getAppUrl } from "@/lib/app-url";
import { isOutputLink, OUTPUT_LINK_ERROR } from "@/lib/links";
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
import { Constants } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };
// updateRequest also returns the saved status (it can change automatically).
type UpdateResult = { ok: true; status?: string } | { ok: false; error: string };

const patchSchema = z
  .object({
    status: z.enum(Constants.public.Enums.request_status),
    assigned_designer_id: z.uuid().nullable(),
    link_to_output: z
      .string()
      .trim()
      .max(2000, "Please keep the link under 2,000 characters.")
      .refine((v) => !v || isOutputLink(v), OUTPUT_LINK_ERROR)
      .transform((v) => v || null)
      .nullable(),
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
// Marketing team member can; only Super Admins and Lead Designers can assign the
// designer. Picking or removing a designer also updates the status
// automatically (in the database).
// The database enforces the same rules (RLS + column guard) and writes the
// activity log.
export async function updateRequest(requestId: string, patch: RequestPatch): Promise<UpdateResult> {
  const user = await getCurrentUser();
  if (!user?.isStaff) return { ok: false, error: "Only the Marketing team can change requests." };
  if (!z.uuid().safeParse(requestId).success) return { ok: false, error: "Request not found." };

  const parsed = patchSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your changes." };
  const changes = parsed.data;
  const fields = Object.keys(changes);
  if (fields.length === 0) return { ok: true };
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("requests")
    .select("status, assigned_designer_id, requester_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!before) return { ok: false, error: "Request not found." };
  // Designers and Admins (owner, Oct 22): take an unassigned request for
  // yourself, or change the designer to anyone once it has one. The database
  // checks too.
  if (!user.isManager && "assigned_designer_id" in changes) {
    if (!user.designerId && !user.isAdmin) return { ok: false, error: "Only the Design team can assign designers." };
    if (changes.assigned_designer_id === null) {
      return { ok: false, error: "Only Super Admins and Lead Designers can remove the designer." };
    }
    if (!before.assigned_designer_id && (!user.designerId || changes.assigned_designer_id !== user.designerId)) {
      return { ok: false, error: "You can take this request for yourself; a Lead Designer assigns it to someone else." };
    }
  }

  const { data, error } = await supabase
    .from("requests")
    .update(changes)
    .eq("id", requestId)
    .select("id, request_code, status, assigned_designer_id")
    .maybeSingle();
  if (error) {
    console.error("updateRequest failed", error);
    return { ok: false, error: error.code === "42501" ? error.message : "We couldn't save the change. Please try again." };
  }
  if (!data) return { ok: false, error: "You can't change this request." };

  // Emails (each once):
  // - first designer: taken by themselves → "Accepted" to the requester (not
  //   to themselves if it's their own request); picked by a Lead → N3.
  // - designer changed → N6 to the requester; if someone else was picked,
  //   N3 so they know to accept.
  // - N7 on For requester's review, N8 on Completed.
  const appUrl = await getAppUrl();
  const designerChanged = data.assigned_designer_id !== before.assigned_designer_id && data.assigned_designer_id;
  const tookIt = !!designerChanged && data.assigned_designer_id === user.designerId;
  if (designerChanged && !before.assigned_designer_id) {
    if (tookIt) {
      const own = before.requester_id === user.id;
      after(() => notifyDesignerAccepted(data.id, appUrl, own ? user.email : undefined));
    } else after(() => notifyAssigned(data.id, appUrl));
  }
  if (designerChanged && before.assigned_designer_id) {
    after(() => notifyReassigned(data.id, appUrl));
    if (!tookIt) after(() => notifyAssigned(data.id, appUrl));
  }
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

// Assigned designer: accept the task, or ask to reassign with a reason.
export async function respondAsDesigner(
  requestId: string,
  accept: boolean,
  reason: { category: "Full plate" | "Other concerns"; note: string } | null,
): Promise<Result> {
  const user = await getCurrentUser();
  if (!user?.isDesigner) return { ok: false, error: "Only the assigned designer can respond." };
  let text = "";
  if (!accept) {
    if (!reason) return { ok: false, error: "Please choose a reason." };
    const note = reason.note.trim();
    if (reason.category === "Other concerns" && !note) return { ok: false, error: "Please describe your concern." };
    if (note.length > 2000) return { ok: false, error: "Please keep the note under 2,000 characters." };
    text = note ? `${reason.category}: ${note}` : reason.category;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("designer_respond", { p_request_id: requestId, p_accept: accept, p_reason: text });
  if (error) return { ok: false, error: rpcError(error, "We couldn't save your response. Please try again.") };
  if (accept) {
    const appUrl = await getAppUrl();
    after(() => notifyDesignerAccepted(requestId, appUrl));
  }
  revalidatePath("/admin", "layout");
  return { ok: true };
}
