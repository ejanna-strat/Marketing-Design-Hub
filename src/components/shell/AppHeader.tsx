import Image from "next/image";
import Link from "next/link";
import { theme } from "@/config/theme";
import type { CurrentUser } from "@/lib/auth";
import { HouseIcon, ListChecksIcon } from "lucide-react";
import { Suspense } from "react";
import { IdleSignOut } from "./IdleSignOut";
import { MenuButtonPlaceholder, MobileMenu } from "./MobileMenu";
import { NavLink } from "./NavLink";
import { StaffMenu } from "./StaffMenu";
import { UserMenu } from "./UserMenu";

const linkClass =
  "rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
const phoneLink =
  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground";
const phoneActive = "bg-brand-soft font-medium text-brand hover:bg-brand-soft hover:text-brand";
const activeClass = "bg-brand-soft font-medium text-brand hover:bg-brand-soft hover:text-brand";

function roleLabel(user: CurrentUser) {
  const tags = [
    user.isSuperAdmin ? "Super Admin" : user.isAdmin && "Admin",
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
        {/* Phones (owner, Oct 24): ☰ · logo · name menu. The ☰ menu holds the
            page links and, for the Marketing team, the team menu. */}
        <Suspense fallback={<MenuButtonPlaceholder />}>
          <MobileMenu>
            <NavLink href="/" exact className={phoneLink} activeClassName={phoneActive}>
              <HouseIcon className="size-4 shrink-0" />
              Home
            </NavLink>
            <NavLink href="/my-requests" className={phoneLink} activeClassName={phoneActive}>
              <ListChecksIcon className="size-4 shrink-0" />
              My Requests
            </NavLink>
            {user.isStaff && (
              <>
                <p className="px-3 pt-4 pb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Marketing team
                </p>
                <StaffMenu user={user} />
              </>
            )}
          </MobileMenu>
        </Suspense>
        <Link href="/" className="flex items-center gap-2">
          <Image src="/brand/logo.png" alt="" width={30} height={30} priority />
          <span className="hidden font-brand font-bold text-brand sm:inline">{theme.appName}</span>
        </Link>
        <nav className="hidden flex-1 items-center gap-1 md:flex">
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
        <span className="flex-1 md:hidden" />
        <UserMenu name={user.fullName} email={user.email} roleLabel={roleLabel(user)} theme={user.theme} />
      </div>
      {/* Any team tag gets the longer limit, even on requester pages. */}
      <IdleSignOut team={user.isStaff} />
    </header>
  );
}
