"use client";

import { cn } from "@/lib/utils";
import { useUrlParams } from "./use-url-params";

const OPEN = { value: "open", label: "Open" };
const ON_HOLD = { value: "on_hold", label: "On Hold" };
const COMPLETED = { value: "completed", label: "Completed" };
const ALL = { value: "all", label: "All" };
const VIEWS = {
  // Completed requests have their own page (owner, Oct 30).
  pipeline: [OPEN, ON_HOLD, ALL],
  deals: [OPEN, ON_HOLD, COMPLETED, ALL],
  // My Requests also has Inactive (owner, Oct 21).
  requester: [OPEN, ON_HOLD, COMPLETED, { value: "inactive", label: "Inactive" }, ALL],
};

// Open (default) / On Hold / All for the pipeline tabs (owner, Oct 20; On
// Hold added Oct 21); Deal Requests and My Requests also have Completed.
export function ViewSwitch({ list = "pipeline" }: { list?: keyof typeof VIEWS }) {
  const views = VIEWS[list];
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
