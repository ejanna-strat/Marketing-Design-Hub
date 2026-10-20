"use client";

import { cn } from "@/lib/utils";
import { useUrlParams } from "./use-url-params";

const VIEWS = [
  { value: "open", label: "Open" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
] as const;

// Open (default) / Completed / All for the pipeline tabs (owner, Oct 20).
export function ViewSwitch() {
  const { get, setParams } = useUrlParams();
  const current = get("view") || "open";
  return (
    <div role="radiogroup" aria-label="Show" className="inline-flex rounded-lg border bg-background p-0.5 text-sm">
      {VIEWS.map((v) => (
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
