import "server-only";
import type { Approver } from "@/components/form/ApproverNameInput";
import type { createClient } from "@/lib/supabase/server";

// The last 5 different approvers this requester named (not themselves), for
// the Approver Name suggestions (owner, Oct 22).
export async function recentApprovers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requesterId: string,
  ownEmail: string,
): Promise<Approver[]> {
  const { data } = await supabase
    .from("requests")
    .select("final_approver_name, final_approver_email")
    .eq("requester_id", requesterId)
    .order("created_at", { ascending: false })
    .limit(50);
  const seen = new Set([ownEmail.toLowerCase()]);
  const out: Approver[] = [];
  for (const r of data ?? []) {
    const email = r.final_approver_email.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({ name: r.final_approver_name, email: r.final_approver_email });
    if (out.length === 5) break;
  }
  return out;
}
