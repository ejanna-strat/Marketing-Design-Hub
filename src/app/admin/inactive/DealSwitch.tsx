"use client";

import { useUrlParams } from "@/components/data-table/use-url-params";
import { cn } from "@/lib/utils";

const VIEWS = [
  { value: "", label: "All" },
  { value: "yes", label: "With deals" },
  { value: "no", label: "Without deals" },
];

// Inactive Requests: All / With deals / Without deals (owner, Oct 23; replaces
// the Deal Associated filter). Same look as the pipeline's Show switch.
export function DealSwitch() {
  const { get, setParams } = useUrlParams();
  const current = get("deal");
  return (
    <div className="inline-flex items-center gap-1 rounded-full border bg-background py-1 pr-1 pl-3 text-sm shadow-sm">
      <span className="mr-1 text-muted-foreground">Show:</span>
      <div role="radiogroup" aria-label="Show" className="flex flex-wrap gap-0.5">
        {VIEWS.map((v) => (
          <button
            key={v.label}
            type="button"
            role="radio"
            aria-checked={current === v.value}
            onClick={() => setParams({ deal: v.value || null })}
            className={cn(
              "h-7 cursor-pointer rounded-full px-3 font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              current === v.value ? "bg-brand text-white shadow-sm" : "text-foreground/80 hover:bg-brand-soft hover:text-brand",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
