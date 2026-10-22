"use client";

import { ChevronDownIcon, HourglassIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { MenuTip } from "./MenuTip";

// Pendings in the left menu, with a dropdown of each pending category and
// its count (owner, Oct 20).
export function PendingsMenu({ tabs }: { tabs: { status: string; label: string; count: number }[] }) {
  const pathname = usePathname();
  const status = useSearchParams().get("status") ?? "new_request";
  const onPage = pathname === "/admin/pendings";
  const [open, setOpen] = useState(onPage);
  const total = tabs.reduce((n, t) => n + t.count, 0);

  return (
    <div>
      <div
        className={cn(
          "flex items-center rounded-lg text-sm",
          onPage ? "bg-brand-soft font-medium text-brand" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Link
          href="/admin/pendings"
          className="group/item relative flex flex-1 items-center gap-2.5 px-3 py-2 group-data-[collapsed=true]/side:justify-center group-data-[collapsed=true]/side:px-0"
        >
          <HourglassIcon className="size-4 shrink-0" />
          <span className="flex-1 group-data-[collapsed=true]/side:sr-only">Pendings</span>
          <MenuTip>Pendings ({total})</MenuTip>
          <span className="text-xs group-data-[collapsed=true]/side:hidden">{total}</span>
          {/* Shrunk menu: the count sits on the icon (owner's mock-up, Oct 22). */}
          {total > 0 && (
            <span className="absolute top-0.5 right-0.5 hidden min-w-4 rounded-full bg-emerald-600 px-1 text-center text-[10px] leading-4 font-semibold text-white group-data-[collapsed=true]/side:block">
              {total}
            </span>
          )}
        </Link>
        <button
          type="button"
          aria-label={open ? "Hide pending categories" : "Show pending categories"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="rounded-md p-2 hover:bg-muted group-data-[collapsed=true]/side:hidden"
        >
          <ChevronDownIcon className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && (
        <ul className="mt-1 ml-5 space-y-0.5 border-l pl-2 group-data-[collapsed=true]/side:hidden">
          {tabs.map((t) => {
            const active = onPage && status === t.status;
            return (
              <li key={t.status}>
                <Link
                  href={`/admin/pendings?status=${t.status}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between rounded-md px-2 py-1.5 text-sm",
                    active ? "font-medium text-brand" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {t.label}
                  <span className="text-xs">({t.count})</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
