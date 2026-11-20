import Image from "next/image";
import Link from "next/link";
import { roleLabel } from "@/components/shell/AppHeader";
import { IdleSignOut } from "@/components/shell/IdleSignOut";
import { UserMenu } from "@/components/shell/UserMenu";
import { theme } from "@/config/theme";
import type { CurrentUser } from "@/lib/auth";

// The Marketing Support Hub's own top bar (main page and suite Settings),
// outside any one hub. `children` sits before the profile menu.
export function SuiteHeader({ user, children }: { user: CurrentUser; children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
        <Link
          href="/hubs"
          className="flex flex-1 items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Image src="/brand/logo.png" alt="" width={30} height={30} priority />
          <span className="font-brand font-bold text-brand">{theme.suiteName}</span>
        </Link>
        {children}
        <UserMenu
          name={user.fullName}
          email={user.email}
          roleLabel={roleLabel(user)}
          theme={user.theme}
          showSettings={user.canOpenSettings}
        />
      </div>
      <IdleSignOut team={user.isStaff} />
    </header>
  );
}
