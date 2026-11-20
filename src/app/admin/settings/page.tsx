import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";

export default async function HubSettingsHome() {
  const user = await requireStaff();
  if (user.isManager) redirect("/admin/settings/faqs");
  redirect(user.canOpenSettings ? "/settings" : "/admin/pipeline");
}
