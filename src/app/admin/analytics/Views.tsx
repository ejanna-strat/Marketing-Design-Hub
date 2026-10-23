"use client";

import { ChevronRightIcon } from "lucide-react";
import { Fragment, useState } from "react";
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

// Requests by status in 4 groups (Open, Completed, On hold, Inactive); click
// a group to see its statuses.
export function StatusGroups({
  groups,
  total,
}: {
  groups: { label: string; value: number; items: { label: string; value: number }[] }[];
  total: number;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const max = Math.max(1, ...groups.map((g) => g.value));
  const pct = (v: number) => (total ? `${v} (${Math.round((v / total) * 100)}%)` : String(v));
  const bar = (v: number, soft = false) => (
    <span className="flex items-center gap-2">
      <span
        className={cn("h-4 rounded-r", soft ? "bg-brand/50" : "bg-brand")}
        style={{ width: `${(v / max) * 80}%`, minWidth: v ? 4 : 0 }}
        aria-hidden
      />
      <span className="text-xs font-semibold whitespace-nowrap tabular-nums">{pct(v)}</span>
    </span>
  );
  return (
    <ul className="space-y-2.5">
      {groups.map((g) => {
        const isOpen = open.has(g.label);
        const can = g.items.length > 1;
        return (
          <Fragment key={g.label}>
            <li className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
              {can ? (
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() =>
                    setOpen((o) => {
                      const next = new Set(o);
                      if (next.has(g.label)) next.delete(g.label);
                      else next.add(g.label);
                      return next;
                    })
                  }
                  className="inline-flex cursor-pointer items-center justify-end gap-1 text-right text-sm font-medium text-brand hover:underline"
                >
                  <ChevronRightIcon className={cn("size-4 transition-transform", isOpen && "rotate-90")} aria-hidden />
                  {g.label}
                </button>
              ) : (
                <span className="text-right text-sm font-medium">{g.label}</span>
              )}
              {bar(g.value)}
            </li>
            {isOpen &&
              g.items.map((i) => (
                <li
                  key={`${g.label}-${i.label}`}
                  className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]"
                >
                  <span className="text-right text-xs leading-snug text-muted-foreground">{i.label}</span>
                  {bar(i.value, true)}
                </li>
              ))}
          </Fragment>
        );
      })}
    </ul>
  );
}
