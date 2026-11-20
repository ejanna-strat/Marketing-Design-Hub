import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";

export default async function SettingsHome() {
  const user = await requireStaff();
  if (user.canManageMembers) redirect("/admin/settings/members");
  if (user.canPostAnnouncements) redirect("/admin/settings/announcements");
  redirect("/admin/pipeline");
}
