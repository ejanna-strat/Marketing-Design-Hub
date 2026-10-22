"use client";

import { ChevronDownIcon, ClipboardListIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Design Pipeline in the left menu, with a dropdown of Unassigned and each
// designer and their open requests (owner, Oct 22), like Pendings. Each
// opens that designer's pipeline tab.
export function PipelineMenu({ items }: { items: { value: string; label: string; count: number }[] }) {
  const pathname = usePathname();
  const designer = useSearchParams().get("designer") ?? "";
  const onPage = pathname === "/admin/pipeline";
  const [open, setOpen] = useState(onPage);

  return (
    <div>
      <div
        className={cn(
          "flex items-center rounded-lg text-sm",
          onPage ? "bg-brand-soft font-medium text-brand" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Link
          href="/admin/pipeline"
          title="Design Pipeline"
          className="flex flex-1 items-center gap-2.5 px-3 py-2 group-data-[collapsed=true]/side:justify-center group-data-[collapsed=true]/side:px-0"
        >
          <ClipboardListIcon className="size-4 shrink-0" />
          <span className="flex-1 group-data-[collapsed=true]/side:sr-only">Design Pipeline</span>
        </Link>
        <button
          type="button"
          aria-label={open ? "Hide designers" : "Show designers"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="rounded-md p-2 hover:bg-muted group-data-[collapsed=true]/side:hidden"
        >
          <ChevronDownIcon className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && (
        <ul className="mt-1 ml-5 space-y-0.5 border-l pl-2 group-data-[collapsed=true]/side:hidden">
          {items.map((t) => {
            const active = onPage && designer === t.value;
            return (
              <li key={t.value}>
                <Link
                  href={`/admin/pipeline?designer=${t.value}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between rounded-md px-2 py-1.5 text-sm",
                    active ? "font-medium text-brand" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span className="truncate">{t.label}</span>
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
