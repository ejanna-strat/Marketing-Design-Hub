import { requireStaff } from "@/lib/auth";
import { SettingsTabs } from "./SettingsTabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  return (
    <div className="space-y-6">
      <SettingsTabs showFaqs={user.isManager} />
      {children}
    </div>
  );
}
