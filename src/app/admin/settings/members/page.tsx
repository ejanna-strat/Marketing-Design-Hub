import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MembersManager } from "./MembersManager";

export const metadata = { title: "Members · Settings" };

export default async function MembersPage() {
  const user = await requireManager();
  const supabase = await createClient();

  const [{ data: members, error }, { data: profiles }] = await Promise.all([
    supabase
      .from("team_members")
      .select("email, full_name, roles, designer_display_name, gets_team_emails")
      .order("full_name"),
    supabase.from("profiles").select("email"),
  ]);
  if (error) throw new Error(error.message);
  const signedIn = new Set((profiles ?? []).map((p) => p.email.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Settings</p>
        <h1 className="text-2xl font-bold">Members</h1>
        <p className="max-w-2xl text-muted-foreground">
          People on the Marketing team and what they can do in the app. Changes apply the next time they open or
          refresh a page. Everyone else at Stratpoint is a Requester: they can file requests and track their own.
        </p>
      </div>
      <MembersManager
        currentEmail={user.email}
        canGrantAdmin={user.isAdmin}
        members={(members ?? []).map((m) => ({
          email: m.email,
          fullName: m.full_name,
          roles: m.roles.filter((r) => r !== "requester"),
          designerName: m.designer_display_name ?? "",
          getsTeamEmails: m.gets_team_emails,
          signedIn: signedIn.has(m.email),
        }))}
      />
    </div>
  );
}
