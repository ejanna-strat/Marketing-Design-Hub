import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function SettingsHome() {
  const user = await requireUser();
  if (user.canManageMembers) redirect("/settings/members");
  if (user.canPostAnnouncements) redirect("/settings/announcements");
  redirect("/hubs");
}
