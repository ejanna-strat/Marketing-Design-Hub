import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  teamId: string | null;
  roles: Enums<"app_role">[];
  isAdmin: boolean;
  isLeadDesigner: boolean;
  // Designer or Lead Designer: can be assigned requests.
  isDesigner: boolean;
  // Admin or Lead Designer: can change every pipeline field and manage members.
  isManager: boolean;
  // Admin, Lead Designer or Designer: can open the pipeline.
  isStaff: boolean;
  // The designers row linked to this person, if they are a designer.
  designerId: string | null;
};

// The signed-in person with their profile and roles. Cached per request.
// The session is checked locally (getClaims), then one query loads the
// profile, roles and designer link together.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const claims = auth?.claims;
  if (!claims?.sub) return null;
  const userId = claims.sub;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, team_id, user_roles(role), designers(id)")
    .eq("id", userId)
    .maybeSingle();

  const roles = (profile?.user_roles ?? []).map((r) => r.role);
  const designer = Array.isArray(profile?.designers) ? profile.designers[0] : profile?.designers;
  const isAdmin = roles.includes("admin");
  const isLeadDesigner = roles.includes("lead_designer");
  const isDesigner = isLeadDesigner || roles.includes("designer");
  return {
    id: userId,
    email: profile?.email ?? (typeof claims.email === "string" ? claims.email : ""),
    fullName: profile?.full_name ?? "",
    teamId: profile?.team_id ?? null,
    roles,
    isAdmin,
    isLeadDesigner,
    isDesigner,
    isManager: isAdmin || isLeadDesigner,
    isStaff: isAdmin || isDesigner,
    designerId: designer?.id ?? null,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// Marketing team only. Everyone else goes back to the home page.
export async function requireStaff(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isStaff) redirect("/");
  return user;
}

// Admins and Lead Designers only. Designers go back to the pipeline.
export async function requireManager(): Promise<CurrentUser> {
  const user = await requireStaff();
  if (!user.isManager) redirect("/admin/pipeline");
  return user;
}
