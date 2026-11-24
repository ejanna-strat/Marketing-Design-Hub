"use client";

import { NavLink } from "@/components/shell/NavLink";

// Creative Hub's own settings (Super Admins and Lead Designers): Requester
// FAQs and Archive (owner, Nov 24).
const TABS = [
  { href: "/admin/settings/faqs", label: "Requester FAQs" },
  { href: "/admin/settings/archive", label: "Archive" },
];

export function HubSettingsTabs() {
  return (
    <nav aria-label="Hub settings" className="flex gap-1 overflow-x-auto border-b">
      {TABS.map((t) => (
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
