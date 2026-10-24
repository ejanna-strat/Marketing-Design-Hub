"use client";

import { cn } from "@/lib/utils";
import { useUrlParams } from "./use-url-params";

const PIPELINE_VIEWS = [
  { value: "open", label: "Open" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
];
// My Requests also has Inactive (owner, Oct 21).
const REQUESTER_VIEWS = [...PIPELINE_VIEWS.slice(0, 3), { value: "inactive", label: "Inactive" }, PIPELINE_VIEWS[3]];

// Open (default) / On Hold / Completed / All for the pipeline tabs (owner,
// Oct 20; On Hold added Oct 21).
export function ViewSwitch({ requester = false }: { requester?: boolean }) {
  const views = requester ? REQUESTER_VIEWS : PIPELINE_VIEWS;
  const { get, setParams } = useUrlParams();
  const current = get("view") || "open";
  // One rounded bar with a "Show:" label; the selected option is a filled
  // pill and the others highlight on hover (owner's mock-up, Oct 21).
  return (
    // Phones (owner, Oct 24): no "Show:" label and tighter pills, so all
    // the options fit on one line.
    <div className="inline-flex max-w-full items-center gap-1 rounded-full border bg-background p-1 text-[13px] shadow-sm sm:pl-3 sm:text-sm">
      <span className="mr-1 hidden text-muted-foreground sm:inline">Show:</span>
      <div role="radiogroup" aria-label="Show" className="flex gap-0.5">
        {views.map((v) => (
          <button
            key={v.value}
            type="button"
            role="radio"
            aria-checked={current === v.value}
            onClick={() => setParams({ view: v.value === "open" ? null : v.value })}
            className={cn(
              "h-7 cursor-pointer rounded-full px-2.5 font-medium whitespace-nowrap sm:px-3 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              current === v.value
                ? "bg-brand text-white shadow-sm"
                : "text-foreground/80 hover:bg-brand-soft hover:text-brand",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
