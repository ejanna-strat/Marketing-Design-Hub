"use client";

import { useUrlParams } from "@/components/data-table/use-url-params";
import { cn } from "@/lib/utils";

// Pendings tabs with counts (§7.2 #5).
export function PendingTabs({
  tabs,
  current,
}: {
  tabs: { status: string; label: string; count: number }[];
  current: string;
}) {
  const { setParams, pending } = useUrlParams();
  return (
    <div role="tablist" aria-label="Pending status" className={cn("flex gap-1 overflow-x-auto border-b", pending && "opacity-60")}>
      {tabs.map((t) => {
        const active = t.status === current;
        return (
          <button
            key={t.status}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setParams({ status: t.status })}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
              active
                ? "border-brand font-medium text-brand"
                : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
            )}
          >
            {t.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-xs font-semibold",
                active ? "bg-brand text-white" : "bg-muted text-muted-foreground",
              )}
            >
              {t.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
