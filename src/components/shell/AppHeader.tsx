import Image from "next/image";
import Link from "next/link";
import { theme } from "@/config/theme";
import type { CurrentUser } from "@/lib/auth";
import { NavLink } from "./NavLink";
import { UserMenu } from "./UserMenu";

const linkClass =
  "rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
const activeClass = "bg-brand-soft font-medium text-brand hover:bg-brand-soft hover:text-brand";

function roleLabel(user: CurrentUser) {
  const tags = [
    user.isAdmin && "Admin",
    user.isLeadDesigner && "Lead Designer",
    user.roles.includes("designer") && "Designer",
  ].filter(Boolean);
  return tags.length ? tags.join(" · ") : "Requester";
}

// Top bar on every signed-in page. Requesters see only Home and My Requests;
// Marketing staff also get a link to the Design Pipeline.
export function AppHeader({ user }: { user: CurrentUser }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/brand/logo.png" alt="" width={30} height={30} priority />
          <span className="hidden font-brand font-bold text-brand sm:inline">{theme.appName}</span>
        </Link>
        <nav className="flex flex-1 items-center gap-1">
          <NavLink href="/" exact className={linkClass} activeClassName={activeClass}>
            Home
          </NavLink>
          <NavLink href="/my-requests" className={linkClass} activeClassName={activeClass}>
            My Requests
          </NavLink>
          {user.isStaff && (
            <NavLink href="/admin" className={linkClass} activeClassName={activeClass}>
              Design Pipeline
            </NavLink>
          )}
        </nav>
        <UserMenu name={user.fullName} email={user.email} roleLabel={roleLabel(user)} theme={user.theme} />
      </div>
    </header>
  );
}
