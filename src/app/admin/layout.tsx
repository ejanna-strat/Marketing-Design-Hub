import {
  ArchiveIcon,
  BarChart3Icon,
  BriefcaseBusinessIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  MessageSquareHeartIcon,
  SettingsIcon,
} from "lucide-react";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { AppHeader } from "@/components/shell/AppHeader";
import { NavLink } from "@/components/shell/NavLink";
import { PendingsMenu } from "@/components/shell/PendingsMenu";
import { Sidebar } from "@/components/shell/Sidebar";
import { SIDEBAR_COOKIE } from "@/components/shell/sidebar-cookie";
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
    { title: "Analytics", icon: BarChart3Icon, href: "/admin/analytics" },
    ...(isManager ? [{ title: "Settings", icon: SettingsIcon, href: "/admin/settings" }] : []),
  ];
}

// Collapsed menu (icons only): labels hide, icons centre.
const itemClass =
  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm group-data-[collapsed=true]/side:justify-center group-data-[collapsed=true]/side:px-0";
const labelClass = "group-data-[collapsed=true]/side:sr-only";

// Admin and designer screens. Checked on the server: anyone else is sent home.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";
  const supabase = await createClient();
  const { data: open } = await supabase.from("requests").select("status").in("status", PENDING_TABS.map((t) => t.status));
  const pendingTabs = PENDING_TABS.map((t) => ({ ...t, count: (open ?? []).filter((r) => r.status === t.status).length }));

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader user={user} />
      <div className="flex gap-6 px-4 py-6 sm:px-6">
        <Sidebar initialCollapsed={collapsed}>
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
                  title={item.title}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className={labelClass}>{item.title}</span>
                </NavLink>
              ) : (
                <div
                  key={item.title}
                  aria-disabled
                  title={`${item.title} (coming soon)`}
                  className={`${itemClass} cursor-not-allowed text-muted-foreground/60`}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className={`flex-1 ${labelClass}`}>{item.title}</span>
                  <span className={`text-[10px] uppercase tracking-wide ${labelClass}`}>Soon</span>
                </div>
              ),
            )}
        </Sidebar>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
