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
  return (
    <div role="radiogroup" aria-label="Show" className="inline-flex rounded-lg border bg-background p-0.5 text-sm">
      {views.map((v) => (
        <button
          key={v.value}
          type="button"
          role="radio"
          aria-checked={current === v.value}
          onClick={() => setParams({ view: v.value === "open" ? null : v.value })}
          className={cn(
            "rounded-md px-3 py-1 transition-colors",
            current === v.value ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
