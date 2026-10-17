"use client";

import { useUrlParams } from "@/components/data-table/use-url-params";
import { cn } from "@/lib/utils";

// One tab per Designer / Lead Designer (from the team list), plus All and
// Unassigned. Selecting a tab keeps the other filters.
export function DesignerTabs({
  designers,
  current,
  myDesignerId,
}: {
  designers: { id: string; name: string }[];
  // "" = All, "none" = Unassigned, or a designer id
  current: string;
  myDesignerId: string | null;
}) {
  const { setParams, pending } = useUrlParams();
  const tabs = [
    { value: "all", label: "All", active: current === "" },
    { value: "none", label: "Unassigned", active: current === "none" },
    ...designers.map((d) => ({
      value: d.id,
      label: d.id === myDesignerId ? `${d.name} (me)` : d.name,
      active: current === d.id,
    })),
  ];

  return (
    <div
      role="tablist"
      aria-label="Designer"
      className={cn("flex gap-1 overflow-x-auto border-b", pending && "opacity-60")}
    >
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={t.active}
          onClick={() => setParams({ designer: t.value })}
          className={cn(
            "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
            t.active
              ? "border-brand font-medium text-brand"
              : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
