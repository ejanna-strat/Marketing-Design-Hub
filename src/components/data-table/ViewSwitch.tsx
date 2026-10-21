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
    <div className="inline-flex items-center gap-1 rounded-full border bg-background py-1 pr-1 pl-3 text-sm shadow-sm">
      <span className="mr-1 text-muted-foreground">Show:</span>
      <div role="radiogroup" aria-label="Show" className="flex flex-wrap gap-0.5">
        {views.map((v) => (
          <button
            key={v.value}
            type="button"
            role="radio"
            aria-checked={current === v.value}
            onClick={() => setParams({ view: v.value === "open" ? null : v.value })}
            className={cn(
              "h-7 cursor-pointer rounded-full px-3 font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
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
