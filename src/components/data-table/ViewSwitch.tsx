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
  // Each option looks like its own button so it's clear they can be clicked
  // (owner, Oct 21).
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Show:</span>
      <div role="radiogroup" aria-label="Show" className="flex flex-wrap gap-1.5">
        {views.map((v) => (
          <button
            key={v.value}
            type="button"
            role="radio"
            aria-checked={current === v.value}
            onClick={() => setParams({ view: v.value === "open" ? null : v.value })}
            className={cn(
              "h-8 cursor-pointer rounded-lg border px-3 font-medium shadow-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              current === v.value
                ? "border-brand bg-brand text-white"
                : "border-input bg-background text-foreground hover:border-brand/60 hover:bg-brand-soft hover:text-brand",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
