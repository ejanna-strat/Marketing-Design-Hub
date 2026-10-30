import { cookies } from "next/headers";
import { AppHeader } from "@/components/shell/AppHeader";
import { Sidebar } from "@/components/shell/Sidebar";
import { SIDEBAR_COOKIE } from "@/components/shell/sidebar-cookie";
import { StaffMenu } from "@/components/shell/StaffMenu";
import { requireStaff } from "@/lib/auth";

// Admin and designer screens. Checked on the server: anyone else is sent home.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader user={user} />
      <div className="flex gap-6 px-4 py-6 sm:px-6">
        <Sidebar initialCollapsed={collapsed}>
          <StaffMenu user={user} />
        </Sidebar>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
