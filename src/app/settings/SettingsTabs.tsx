"use client";

import { NavLink } from "@/components/shell/NavLink";

// Marketing Support Hub Settings, one tab each. Members: Super Admins, Admins
// and Lead Designers. Announcements: Super Admins and the people they tick.
// Usage: everyone on the Marketing team.
export function SettingsTabs({
  showMembers,
  showAnnouncements,
  showUsage,
}: {
  showMembers: boolean;
  showAnnouncements: boolean;
  showUsage: boolean;
}) {
  const tabs = [
    ...(showMembers ? [{ href: "/settings/members", label: "Members" }] : []),
    ...(showAnnouncements ? [{ href: "/settings/announcements", label: "Announcements" }] : []),
    ...(showUsage ? [{ href: "/settings/usage", label: "Usage" }] : []),
  ];
  return (
    <nav aria-label="Settings" className="flex gap-1 overflow-x-auto border-b">
      {tabs.map((t) => (
        <NavLink
          key={t.href}
          href={t.href}
          className="-mb-px shrink-0 border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:border-muted-foreground/30 hover:text-foreground"
          activeClassName="border-brand font-medium text-brand hover:border-brand hover:text-brand"
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
