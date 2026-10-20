import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getRequestByCode } from "@/lib/requests/detail";
import { type AnswerValue, QUESTION_COLUMNS, toFormQuestion } from "@/lib/requests/schema";
import { createClient } from "@/lib/supabase/server";
import { SpecsForm } from "./SpecsForm";

// Marketing team: edit a request's specification answers. The type of
// request is fixed (a different type needs a new request).
export default async function EditSpecificationsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  await requireStaff();
  const supabase = await createClient();
  const request = await getRequestByCode(supabase, code);
  if (!request) notFound();

  const { data: rows, error } = await supabase
    .from("form_questions")
    .select(QUESTION_COLUMNS)
    .eq("request_type_id", request.request_type_id)
    .eq("active", true)
    .order("sort_order");
  if (error) throw new Error(error.message);

  const answers: Record<string, AnswerValue> = {};
  for (const a of request.answers) {
    if (Array.isArray(a.value)) answers[a.question_id] = a.value.map(String);
    else if (typeof a.value === "string") answers[a.question_id] = a.value;
  }

  return (
    <SpecsForm
      requestId={request.id}
      code={request.request_code}
      title={request.title}
      typeName={request.request_type?.name ?? ""}
      questions={(rows ?? []).map(toFormQuestion)}
      initialAnswers={answers}
    />
  );
}
