import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canRequesterEdit, getRequestByCode } from "@/lib/requests/detail";
import { type AnswerValue, QUESTION_COLUMNS, toFormQuestion } from "@/lib/requests/schema";
import { createClient } from "@/lib/supabase/server";
import { NewRequestForm } from "../../../requests/new/NewRequestForm";

// The New Design Request form, filled in with the request's current details.
export default async function EditRequestPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const request = await getRequestByCode(supabase, code, { requesterId: user.id });
  if (!request) notFound();
  if (!canRequesterEdit(request)) redirect(`/my-requests/${request.request_code}`);

  const [teams, types, questions] = await Promise.all([
    supabase.from("teams").select("id, name").eq("active", true).order("sort_order"),
    supabase.from("request_types").select("id, name").order("sort_order"),
    supabase
      .from("form_questions")
      .select(QUESTION_COLUMNS)
      .eq("request_type_id", request.request_type_id)
      .eq("active", true)
      .order("sort_order"),
  ]);
  const error = teams.error ?? types.error ?? questions.error;
  if (error) throw new Error(error.message);

  const answers: Record<string, AnswerValue> = {};
  for (const a of request.answers) {
    if (Array.isArray(a.value)) answers[a.question_id] = a.value.map(String);
    else if (typeof a.value === "string") answers[a.question_id] = a.value;
  }
  const approverIsMe =
    request.final_approver_email.toLowerCase() === request.requester_email.toLowerCase() &&
    request.final_approver_name === request.requester_name;

  return (
    <NewRequestForm
      user={{ name: request.requester_name, email: request.requester_email, teamId: request.team_id }}
      teams={teams.data ?? []}
      requestTypes={(types.data ?? []).filter((t) => t.id === request.request_type_id)}
      questions={(questions.data ?? []).map(toFormQuestion)}
      edit={{
        requestId: request.id,
        code: request.request_code,
        values: {
          requester_name: request.requester_name,
          title: request.title,
          team_id: request.team_id,
          request_type_id: request.request_type_id,
          date_needed: request.date_needed,
          final_approver: approverIsMe ? "myself" : "other",
          approver_name: approverIsMe ? "" : request.final_approver_name,
          approver_email: approverIsMe ? "" : request.final_approver_email,
          is_deal: request.is_deal ? "yes" : "no",
          deal_name: request.deal_name ?? "",
          deal_size: request.deal_size === null ? "" : String(request.deal_size),
          answers,
        },
      }}
    />
  );
}
