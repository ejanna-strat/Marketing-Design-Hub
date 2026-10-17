"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getAppUrl } from "@/lib/app-url";
import { getCurrentUser } from "@/lib/auth";
import { notifyFinalOutput } from "@/lib/email/notifications";
import { buildAnswersSchema, QUESTION_COLUMNS, toAnswersPayload, toFormQuestion } from "@/lib/requests/schema";
import { Constants } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

const patchSchema = z
  .object({
    status: z.enum(Constants.public.Enums.request_status),
    assigned_designer_id: z.uuid().nullable(),
    link_to_output: z
      .string()
      .trim()
      .max(2000, "Please keep the link under 2,000 characters.")
      .transform((v) => v || null)
      .nullable(),
    date_needed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a valid date."),
    title: z.string().trim().min(1, "Please enter a request title.").max(200, "Please keep the title under 200 characters."),
    requester_name: z.string().trim().min(1, "Please enter the requester's name.").max(200),
    team_id: z.uuid("Please choose a business unit."),
    final_approver_name: z.string().trim().min(1, "Please enter the approver's name.").max(200),
    final_approver_email: z.email("Please enter a valid approver email.").trim().toLowerCase(),
  })
  .partial()
  .strict();

export type RequestPatch = z.input<typeof patchSchema>;

// Changes pipeline fields and General Information on one request. Every
// Marketing team member can; only Admins and Lead Designers can assign the
// designer. Picking or removing a designer also updates the status
// automatically (in the database).
// The database enforces the same rules (RLS + column guard) and writes the
// activity log.
export async function updateRequest(requestId: string, patch: RequestPatch): Promise<Result> {
  const user = await getCurrentUser();
  if (!user?.isStaff) return { ok: false, error: "Only the Marketing team can change requests." };
  if (!z.uuid().safeParse(requestId).success) return { ok: false, error: "Request not found." };

  const parsed = patchSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your changes." };
  const changes = parsed.data;
  const fields = Object.keys(changes);
  if (fields.length === 0) return { ok: true };
  if (!user.isManager && "assigned_designer_id" in changes) {
    return { ok: false, error: "Only Admins and Lead Designers can assign designers." };
  }

  const supabase = await createClient();
  const { data: before } = await supabase.from("requests").select("status").eq("id", requestId).maybeSingle();
  if (!before) return { ok: false, error: "Request not found." };

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

  // N8 goes out once, the first time a request becomes Completed.
  if (data.status === "completed" && before.status !== "completed") {
    const appUrl = await getAppUrl();
    after(() => notifyFinalOutput(data.id, appUrl));
  }

  revalidatePath("/admin/pipeline");
  revalidatePath(`/admin/requests/${data.request_code}`);
  return { ok: true };
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
