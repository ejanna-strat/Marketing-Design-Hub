import "server-only";
import type { Json } from "@/lib/supabase/database.types";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const DETAIL_COLUMNS = `
  *,
  request_type:request_types(name),
  team:teams(name),
  designer:designers(display_name),
  answers:request_answers(id, question_id, question_label_snapshot, value, question:form_questions(sort_order))
`;

// One request with its answers (in form order). Row Level Security decides
// who may read it; pass requesterId to also limit it to that person's own.
export async function getRequestByCode(supabase: Supabase, code: string, options: { requesterId?: string } = {}) {
  let query = supabase.from("requests").select(DETAIL_COLUMNS).eq("request_code", code.toUpperCase());
  if (options.requesterId) query = query.eq("requester_id", options.requesterId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const answers = [...data.answers].sort((a, b) => (a.question?.sort_order ?? 0) - (b.question?.sort_order ?? 0));
  return { ...data, answers };
}

export type RequestDetail = NonNullable<Awaited<ReturnType<typeof getRequestByCode>>>;

// Requesters can edit their request until it is accepted: still a New request
// with no designer assigned. The database checks the same rule.
export function canRequesterEdit(request: { status: string; assigned_designer_id: string | null }) {
  return request.status === "new_request" && request.assigned_designer_id === null;
}

// An answer as display text (select-all answers joined with commas).
export function answerText(value: Json): string {
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}
