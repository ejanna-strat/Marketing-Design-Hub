import { redirect } from "next/navigation";
import { ANNOUNCEMENT_COLUMNS, toAnnouncement } from "@/lib/announcements";
import { requireStaff } from "@/lib/auth";
import { todayInManila } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { AnnouncementsManager } from "./AnnouncementsManager";
import { PostersList, type Poster } from "./PostersList";

const STAFF_ROLES = ["super_admin", "admin", "lead_designer", "designer"];

export default async function AnnouncementsPage() {
  // Super Admins and Admins, and the team members a Super Admin ticked below.
  const user = await requireStaff();
  if (!user.canPostAnnouncements) redirect("/settings");
  const supabase = await createClient();

  const [{ data, error }, team] = await Promise.all([
    supabase
      .from("announcements")
      .select(ANNOUNCEMENT_COLUMNS)
      .order("starts_on", { ascending: false })
      .order("created_at", { ascending: false }),
    user.isSuperAdmin ? loadPosters() : Promise.resolve(null),
  ]);
  if (error) throw new Error(error.message);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Settings</p>
        <h1 className="text-2xl font-bold">Announcements</h1>
        <p className="max-w-2xl text-muted-foreground">
          Important news on the main page, where everyone picks a space. Up to 3 take turns in the top banner; the
          megaphone at the top right lists every live announcement. People can close the banner; it comes back the next
          time they sign in.
        </p>
      </div>
      <AnnouncementsManager announcements={(data ?? []).map(toAnnouncement)} today={todayInManila()} />
      {team && <PostersList people={team} myId={user.id} />}
    </div>
  );

  async function loadPosters(): Promise<Poster[]> {
    const [{ data: people, error: peopleError }, { data: posters, error: postersError }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, user_roles(role)").order("full_name"),
      supabase.from("announcement_posters").select("user_id"),
    ]);
    if (peopleError) throw new Error(peopleError.message);
    if (postersError) throw new Error(postersError.message);
    const ticked = new Set((posters ?? []).map((p) => p.user_id));
    return (people ?? [])
      .map((p) => ({ ...p, roles: p.user_roles.map((r) => r.role as string) }))
      .filter((p) => p.roles.some((r) => STAFF_ROLES.includes(r)))
      .map((p) => ({
        id: p.id,
        name: p.full_name || p.email,
        email: p.email,
        alwaysLabel: p.roles.includes("super_admin") ? "Super Admin" : p.roles.includes("admin") ? "Admin" : null,
        canPost: ticked.has(p.id),
      }));
  }
}
