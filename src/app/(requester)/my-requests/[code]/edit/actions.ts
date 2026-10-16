"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { todayInManila } from "@/lib/dates";
import { canRequesterEdit } from "@/lib/requests/detail";
import { buildRequestSchema, QUESTION_COLUMNS, toFormQuestion, toSubmitPayload } from "@/lib/requests/schema";
import { createClient } from "@/lib/supabase/server";

// Saves the requester's changes to their own request, while it is not yet
// accepted. Checked here and again in update_request() in the database.
export async function updateMyRequest(requestId: string, values: unknown): Promise<{ error: string }> {
  const user = await requireUser();
  if (!z.uuid().safeParse(requestId).success) return { error: "Request not found." };

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("requests")
    .select("id, request_code, request_type_id, date_needed, status, assigned_designer_id")
    .eq("id", requestId)
    .eq("requester_id", user.id)
    .maybeSingle();
  if (!request) return { error: "Request not found." };
  if (!canRequesterEdit(request)) {
    return { error: "This request has already been accepted, so it can no longer be edited." };
  }

  const { data: rows, error: questionsError } = await supabase
    .from("form_questions")
    .select(QUESTION_COLUMNS)
    .eq("request_type_id", request.request_type_id)
    .eq("active", true)
    .order("sort_order");
  if (questionsError) return { error: "We couldn't load the form. Please try again." };
  const questions = rows.map(toFormQuestion);

  const parsed = buildRequestSchema(questions, todayInManila(), request.date_needed).safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  if (parsed.data.request_type_id !== request.request_type_id) {
    return { error: "The type of request can't be changed. Please submit a new request instead." };
  }

  const { error } = await supabase.rpc("update_request", {
    p_request_id: request.id,
    payload: toSubmitPayload(parsed.data, questions),
  });
  if (error) {
    console.error("update_request failed", error);
    return { error: error.code === "P0001" ? error.message : "We couldn't save your changes. Please try again." };
  }

  redirect(`/my-requests/${request.request_code}?saved=1`);
}
