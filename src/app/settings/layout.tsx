import { redirect } from "next/navigation";
import { SuiteHeader } from "@/components/shell/SuiteHeader";
import { requireUser } from "@/lib/auth";
import { SettingsTabs } from "./SettingsTabs";

// Marketing Support Hub Settings (owner, Nov 20): Members (who has access)
// Announcements and Usage (Nov 24), for the whole suite rather than one hub. Opened from the
// gear on the main page or Settings in the profile menu. Each hub keeps its
// own settings inside it (Creative Hub: Requester FAQs).
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!user.canOpenSettings) redirect("/hubs");
  return (
    <div className="min-h-screen bg-background">
      <SuiteHeader user={user} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <SettingsTabs
          showMembers={user.canManageMembers}
          showAnnouncements={user.canPostAnnouncements}
          showUsage={user.isStaff}
        />
        {children}
      </main>
    </div>
  );
}
