"use client";

import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SIDEBAR_COOKIE } from "./sidebar-cookie";

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
      <div className="sticky top-20 flex flex-col gap-3">
        <nav aria-label="Marketing team" className="space-y-1">
          {children}
        </nav>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Show menu" : "Hide menu"}
          title={collapsed ? "Show menu" : "Hide menu"}
          className={cn(
            "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? <PanelLeftOpenIcon className="size-4" /> : <PanelLeftCloseIcon className="size-4" />}
          {!collapsed && <span>Hide menu</span>}
        </button>
      </div>
    </aside>
  );
}
