"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Saves feedback for one of the requester's own Completed requests. The
// database checks ownership, status and "only once".
export async function submitFeedback(input: {
  code: string;
  process: number;
  output: number;
  comments: string;
}): Promise<{ error: string }> {
  await requireUser();
  const valid = (n: number) => Number.isInteger(n) && n >= 1 && n <= 5;
  if (!valid(input.process) || !valid(input.output)) return { error: "Please rate both the process and the output." };
  if (input.comments.length > 5000) return { error: "Please keep your comments under 5,000 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_feedback", {
    p_request_code: input.code,
    p_process: input.process,
    p_output: input.output,
    p_comments: input.comments,
  });
  if (error) {
    console.error("submit_feedback failed", error);
    return { error: error.code === "P0001" ? error.message : "We couldn't save your feedback. Please try again." };
  }
  const code = (data as { request_code: string }).request_code;
  revalidatePath("/my-requests");
  revalidatePath(`/my-requests/${code}`);
  redirect(`/feedback/thanks?code=${encodeURIComponent(code)}`);
}
