import { requireStaff } from "@/lib/auth";
import { HubSettingsTabs } from "./HubSettingsTabs";

// Creative Hub's own settings ("Hub settings"): Requester FAQs and Archive
// (Nov 24), for Super Admins and Lead Designers. Members, Announcements and
// Usage are in the Marketing Support Hub's Settings (/settings, owner Nov 20).
export default async function HubSettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  return (
    <div className="space-y-6">
      {user.isManager && <HubSettingsTabs />}
      {children}
    </div>
  );
}
