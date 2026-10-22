"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

const memberSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[^@\s]+@stratpoint\.com$/, "Please enter a @stratpoint.com email address."),
  fullName: z.string().trim().min(1, "Please enter the member's name.").max(200),
  roles: z.array(z.enum(["super_admin", "admin", "lead_designer", "designer"])).min(1, "Please choose at least one tag."),
  designerName: z.string().trim().max(60),
  getsTeamEmails: z.boolean(),
});

export type MemberInput = z.input<typeof memberSchema>;

// The database functions enforce the rules (who may change what) and raise
// plain-language messages, so those are shown as they are.
function friendly(error: { code?: string; message: string }) {
  console.error("member update failed", error);
  return error.code === "P0001" || error.code === "42501"
    ? error.message
    : "We couldn't save the change. Please try again.";
}

// Adds a member or changes their tags. Super Admins, Admins and Lead Designers only.
export async function saveMember(input: MemberInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user?.canManageMembers) {
    return { ok: false, error: "Only Super Admins, Admins and Lead Designers can manage members." };
  }

  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const m = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_team_member", {
    p_email: m.email,
    p_full_name: m.fullName,
    p_roles: [...new Set(m.roles)],
    p_designer_name: m.designerName,
    p_gets_team_emails: m.getsTeamEmails,
  });
  if (error) return { ok: false, error: friendly(error) };

  revalidatePath("/admin", "layout");
  return { ok: true };
}

// Removes a member; they become a Requester again.
export async function removeMember(email: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user?.canManageMembers) {
    return { ok: false, error: "Only Super Admins, Admins and Lead Designers can manage members." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_team_member", { p_email: email });
  if (error) return { ok: false, error: friendly(error) };

  revalidatePath("/admin", "layout");
  return { ok: true };
}
