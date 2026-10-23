"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Hick's Law on Analytics (owner, Oct 23): show fewer things at once so it's
// quicker to find what you need. Nothing is removed; it's one click away.

// One view of a section at a time, picked with a small switch at its top.
export function SectionViews({ label, views }: { label: string; views: { key: string; label: string; content: React.ReactNode }[] }) {
  const [current, setCurrent] = useState(views[0]?.key);
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={label} className="inline-flex flex-wrap gap-0.5 rounded-full border bg-background p-1 text-sm shadow-sm">
        {views.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={current === v.key}
            onClick={() => setCurrent(v.key)}
            className={cn(
              "h-7 cursor-pointer rounded-full px-3 font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              current === v.key ? "bg-brand text-white shadow-sm" : "text-foreground/80 hover:bg-brand-soft hover:text-brand",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      {views.map((v) => (
        <div key={v.key} role="tabpanel" hidden={current !== v.key}>
          {v.content}
        </div>
      ))}
    </div>
  );
}
