"use client";

import { ChevronDownIcon, LightbulbIcon, TableIcon } from "lucide-react";
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

// Feedback card's two buttons side by side; what they open shows below them,
// inside the same card (owner, Oct 26).
export function FeedbackDetails({ insights, table }: { insights: string[]; table: React.ReactNode }) {
  const [open, setOpen] = useState<"insights" | "table" | null>(null);
  const button = (key: "insights" | "table", label: string, Icon: typeof LightbulbIcon) => (
    <button
      type="button"
      aria-expanded={open === key}
      onClick={() => setOpen((o) => (o === key ? null : key))}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
        open === key ? "border-brand bg-brand-soft text-brand" : "bg-background text-brand hover:border-brand/60 hover:bg-brand-soft",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {open === key ? `Hide ${label}` : `Show ${label}`}
      <ChevronDownIcon className={cn("size-4 transition-transform", open === key && "rotate-180")} aria-hidden />
    </button>
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {insights.length > 0 && button("insights", "feedback insights", LightbulbIcon)}
        {button("table", "feedback by month", TableIcon)}
      </div>
      {open === "insights" && (
        <div className="rounded-lg border border-brand/20 bg-brand-soft/50 p-4">
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            {insights.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}
      {open === "table" && table}
    </div>
  );
}
