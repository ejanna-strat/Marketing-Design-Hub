"use client";

import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SIDEBAR_COOKIE } from "./sidebar-cookie";
import { MenuTip } from "./MenuTip";

// The Marketing team's left menu. "Hide menu" shrinks it to a strip of icons
// so tables get more room (owner, Oct 22); the choice is remembered in this
// browser. Items read the state through the `group/side` data attribute.
export function Sidebar({ initialCollapsed, children }: { initialCollapsed: boolean; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }
  return (
    <aside
      data-collapsed={collapsed}
      className={cn("group/side hidden shrink-0 transition-[width] duration-200 md:block", collapsed ? "w-11" : "w-56")}
    >
      {/* z-[35]: the shrunk menu's name labels sit above the page content,
          including Analytics' pinned Jump to bar (z-30), but below the top
          header (z-40) (owner, Oct 22). */}
      <div className="sticky top-20 z-[35] space-y-1">
        {/* Heading row with a small, separate hide/show icon, so it doesn't
            read as a menu item (owner, Oct 22). */}
        <div className={cn("flex items-center pb-2", collapsed ? "justify-center" : "justify-between pl-3")}>
          {!collapsed && (
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Marketing team</p>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Show menu" : "Hide menu"}
            title={collapsed ? undefined : "Hide menu"}
            className="group/item relative cursor-pointer rounded-md p-1 text-muted-foreground/70 hover:bg-muted hover:text-foreground"
          >
            {collapsed ? <PanelLeftOpenIcon className="size-4" /> : <PanelLeftCloseIcon className="size-4" />}
            <MenuTip>Show menu</MenuTip>
          </button>
        </div>
        <nav aria-label="Marketing team" className="space-y-1">
          {children}
        </nav>
      </div>
    </aside>
  );
}
