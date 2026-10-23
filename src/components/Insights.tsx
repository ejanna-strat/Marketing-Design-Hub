"use client";

import { ChevronDownIcon, LightbulbIcon } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

// Automatic insights under a table or chart, hidden until "Show insights" is
// clicked so the page stays short (owner, Oct 23). Rules only: each line is
// worked out from the numbers shown.
export function Insights({ lines, note, label = "insights" }: { lines: string[]; note?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (lines.length === 0) return null;
  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-sm font-medium text-brand transition-colors hover:border-brand/60 hover:bg-brand-soft"
      >
        <LightbulbIcon className="size-4" aria-hidden />
        {open ? `Hide ${label}` : `Show ${label}`}
        <ChevronDownIcon className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div id={id} className="rounded-lg border border-brand/20 bg-brand-soft/50 p-4">
          {note && <p className="mb-2 text-xs text-muted-foreground">{note}</p>}
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
