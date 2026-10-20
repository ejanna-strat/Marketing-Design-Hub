import {
  ArchiveIcon,
  BarChart3Icon,
  BriefcaseBusinessIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  MessageSquareHeartIcon,
  SettingsIcon,
} from "lucide-react";
import { Suspense } from "react";
import { AppHeader } from "@/components/shell/AppHeader";
import { NavLink } from "@/components/shell/NavLink";
import { PendingsMenu } from "@/components/shell/PendingsMenu";
import { requireStaff } from "@/lib/auth";
import { PENDING_TABS } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";

type MenuItem = { title: string; icon: typeof ClipboardListIcon; href?: string } | "pendings";

// Later phases show as disabled "Coming soon" items. Settings (Members) is
// for Admins and Lead Designers only.
function menuFor(isManager: boolean): MenuItem[] {
  return [
    { title: "Dashboard", icon: LayoutDashboardIcon, href: "/admin/dashboard" },
    { title: "Design Pipeline", icon: ClipboardListIcon, href: "/admin/pipeline" },
    "pendings",
    { title: "Deal Requests", icon: BriefcaseBusinessIcon, href: "/admin/deals" },
    { title: "Inactive Requests", icon: ArchiveIcon, href: "/admin/inactive" },
    { title: "Feedback", icon: MessageSquareHeartIcon, href: "/admin/feedback" },
    { title: "Analytics", icon: BarChart3Icon },
    ...(isManager ? [{ title: "Settings", icon: SettingsIcon, href: "/admin/settings" }] : []),
  ];
}

const itemClass = "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm";

// Admin and designer screens. Checked on the server: anyone else is sent home.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const supabase = await createClient();
  const { data: open } = await supabase.from("requests").select("status").in("status", PENDING_TABS.map((t) => t.status));
  const pendingTabs = PENDING_TABS.map((t) => ({ ...t, count: (open ?? []).filter((r) => r.status === t.status).length }));

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader user={user} />
      <div className="flex gap-6 px-4 py-6 sm:px-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-20 space-y-1">
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Marketing team
            </p>
            {menuFor(user.isManager).map((item) =>
              item === "pendings" ? (
                <Suspense key="pendings">
                  <PendingsMenu tabs={pendingTabs} />
                </Suspense>
              ) : item.href ? (
                <NavLink
                  key={item.title}
                  href={item.href}
                  className={`${itemClass} text-muted-foreground hover:bg-muted hover:text-foreground`}
                  activeClassName="bg-brand-soft font-medium text-brand hover:bg-brand-soft hover:text-brand"
                >
                  <item.icon className="size-4" />
                  {item.title}
                </NavLink>
              ) : (
                <div key={item.title} aria-disabled className={`${itemClass} cursor-not-allowed text-muted-foreground/60`}>
                  <item.icon className="size-4" />
                  <span className="flex-1">{item.title}</span>
                  <span className="text-[10px] uppercase tracking-wide">Soon</span>
                </div>
              ),
            )}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
