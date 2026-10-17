import {
  BarChart3Icon,
  ClipboardListIcon,
  HourglassIcon,
  LayoutDashboardIcon,
  MessageSquareHeartIcon,
  SettingsIcon,
} from "lucide-react";
import { AppHeader } from "@/components/shell/AppHeader";
import { NavLink } from "@/components/shell/NavLink";
import { requireStaff } from "@/lib/auth";

// Later phases show as disabled "Coming soon" items. Settings (Members) is
// for Admins and Lead Designers only.
function menuFor(isManager: boolean) {
  return [
    { title: "Dashboard", icon: LayoutDashboardIcon },
    { title: "Design Pipeline", icon: ClipboardListIcon, href: "/admin/pipeline" },
    { title: "Pendings", icon: HourglassIcon },
    { title: "Feedback", icon: MessageSquareHeartIcon, href: "/admin/feedback" },
    { title: "Analytics", icon: BarChart3Icon },
    ...(isManager ? [{ title: "Settings", icon: SettingsIcon, href: "/admin/settings" }] : []),
  ];
}

const itemClass = "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm";

// Admin and designer screens. Checked on the server: anyone else is sent home.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader user={user} />
      <div className="flex gap-6 px-4 py-6 sm:px-6">
        <aside className="hidden w-52 shrink-0 md:block">
          <nav className="sticky top-20 space-y-1">
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Marketing team
            </p>
            {menuFor(user.isManager).map(({ title, icon: Icon, href }) =>
              href ? (
                <NavLink
                  key={title}
                  href={href}
                  className={`${itemClass} text-muted-foreground hover:bg-muted hover:text-foreground`}
                  activeClassName="bg-brand-soft font-medium text-brand hover:bg-brand-soft hover:text-brand"
                >
                  <Icon className="size-4" />
                  {title}
                </NavLink>
              ) : (
                <div key={title} aria-disabled className={`${itemClass} cursor-not-allowed text-muted-foreground/60`}>
                  <Icon className="size-4" />
                  <span className="flex-1">{title}</span>
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
