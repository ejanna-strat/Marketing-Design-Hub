import { requireUser } from "@/lib/auth";
import { QUESTION_COLUMNS, toFormQuestion } from "@/lib/requests/schema";
import { createClient } from "@/lib/supabase/server";
import { NewRequestForm } from "./NewRequestForm";

export default async function NewRequestPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [teams, types, questions] = await Promise.all([
    supabase.from("teams").select("id, name").eq("active", true).order("sort_order"),
    supabase.from("request_types").select("id, name").eq("active", true).order("sort_order"),
    supabase
      .from("form_questions")
      .select(QUESTION_COLUMNS)
      .eq("active", true)
      .not("request_type_id", "is", null)
      .order("sort_order"),
  ]);
  const error = teams.error ?? types.error ?? questions.error;
  if (error) throw new Error(error.message);

  return (
    <NewRequestForm
      user={{ name: user.fullName, email: user.email, teamId: user.teamId }}
      teams={teams.data ?? []}
      requestTypes={types.data ?? []}
      questions={(questions.data ?? []).map(toFormQuestion)}
    />
  );
}
