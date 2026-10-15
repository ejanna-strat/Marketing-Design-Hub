"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { todayInManila } from "@/lib/dates";
import { buildRequestSchema, QUESTION_COLUMNS, toFormQuestion, toSubmitPayload } from "@/lib/requests/schema";
import { createClient } from "@/lib/supabase/server";

// Checks the form again on the server (never trust the browser), then saves
// the request and its answers in one transaction via submit_request().
export async function submitRequest(values: unknown): Promise<{ error: string }> {
  await requireUser();
  const supabase = await createClient();

  const typeId = z.object({ request_type_id: z.uuid() }).safeParse(values);
  if (!typeId.success) return { error: "Please choose a type of design request." };

  const { data: rows, error: questionsError } = await supabase
    .from("form_questions")
    .select(QUESTION_COLUMNS)
    .eq("request_type_id", typeId.data.request_type_id)
    .eq("active", true)
    .order("sort_order");
  if (questionsError) return { error: "We couldn't load the form. Please try again." };
  const questions = rows.map(toFormQuestion);

  const parsed = buildRequestSchema(questions, todayInManila()).safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };

  const { data, error } = await supabase.rpc("submit_request", {
    payload: toSubmitPayload(parsed.data, questions),
  });
  if (error) {
    // submit_request raises plain-language messages (e.g. "Please answer: Copy").
    console.error("submit_request failed", error);
    return { error: error.code === "P0001" ? error.message : "We couldn't submit your request. Please try again." };
  }

  const { request_code } = data as { id: string; request_code: string };
  redirect(`/requests/submitted?code=${encodeURIComponent(request_code)}`);
}
