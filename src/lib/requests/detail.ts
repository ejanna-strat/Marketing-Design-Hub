import "server-only";
import type { Json } from "@/lib/supabase/database.types";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const DETAIL_COLUMNS = `
  *,
  request_type:request_types(name),
  team:teams(name),
  designer:designers(display_name, email),
  feedback(process_rating, output_rating, comments, submitted_at),
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

// 5 years after a request closes, its people are replaced with placeholders
// (0024_anonymize_old_data.sql). On their own old request, the requester sees
// their current name and email instead (owner, Oct 28), and as the approver
// too if they approved it themselves.
export function withOwnDetails<
  T extends {
    anonymized_at: string | null;
    requester_name: string;
    requester_email: string;
    final_approver_name: string;
    final_approver_email: string;
  },
>(request: T, me: { fullName: string; email: string }): T {
  if (!request.anonymized_at) return request;
  const self = request.final_approver_email === request.requester_email;
  return {
    ...request,
    requester_name: me.fullName,
    requester_email: me.email,
    ...(self ? { final_approver_name: me.fullName, final_approver_email: me.email } : {}),
  };
}

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
