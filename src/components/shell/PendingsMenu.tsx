"use client";

import { ChevronDownIcon, HourglassIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

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
        <Link href="/admin/pendings" className="flex flex-1 items-center gap-2.5 px-3 py-2">
          <HourglassIcon className="size-4" />
          <span className="flex-1">Pendings</span>
          <span className="text-xs">{total}</span>
        </Link>
        <button
          type="button"
          aria-label={open ? "Hide pending categories" : "Show pending categories"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="rounded-md p-2 hover:bg-muted"
        >
          <ChevronDownIcon className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && (
        <ul className="mt-1 ml-5 space-y-0.5 border-l pl-2">
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
