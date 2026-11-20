import { requireStaff } from "@/lib/auth";

// Creative Hub's own settings ("Hub settings"): Requester FAQs. Members and
// Announcements moved to the Marketing Support Hub's Settings (/settings,
// owner Nov 20).
export default async function HubSettingsLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return <div className="space-y-6">{children}</div>;
}
