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
  const [{ data }, { data: profile }] = await Promise.all([
    supabase
      .from("requests")
      .select("final_approver_name, final_approver_email, created_at")
      .eq("requester_id", requesterId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("profiles").select("hidden_approvers").eq("id", requesterId).maybeSingle(),
  ]);
  // Approvers they removed stay hidden unless used again afterwards.
  const hidden = (profile?.hidden_approvers ?? {}) as Record<string, string>;
  const seen = new Set([ownEmail.toLowerCase()]);
  const out: Approver[] = [];
  for (const r of data ?? []) {
    const email = r.final_approver_email.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    if (hidden[email] && r.created_at <= hidden[email]) continue;
    out.push({ name: r.final_approver_name, email: r.final_approver_email });
    if (out.length === 5) break;
  }
  return out;
}
