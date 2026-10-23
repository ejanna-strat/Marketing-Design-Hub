"use client";

import { ChevronRightIcon } from "lucide-react";
import { Fragment, useState } from "react";
import { cn } from "@/lib/utils";

export type BreakdownMonth = {
  month: string;
  label: string;
  cells: string[];
  // Rows shown when the month is opened (e.g. one per type of request).
  details: { label: string; cells: string[] }[];
};

// Month on Month tables with one row per month; click a month to see its
// breakdown by type of request (owner, Oct 23: Deal requests, then Inactive
// requests). Compact rows, only as wide as needed.
export function MonthBreakdown({
  headers,
  months,
  total,
}: {
  headers: string[];
  months: BreakdownMonth[];
  total?: { label: string; cells: string[] };
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (m: string) =>
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  const td = "px-3 py-1.5 text-right tabular-nums whitespace-nowrap";
  return (
    <div className="overflow-x-auto">
      <table className="zebra w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="px-3 py-1.5 text-left font-medium">Month</th>
            {headers.map((h) => (
              <th key={h} className="px-3 py-1.5 text-right font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map((m) => {
            const can = m.details.length > 0;
            const isOpen = open.has(m.month);
            return (
              <Fragment key={m.month}>
                <tr className="border-b last:border-0">
                  <td className="px-3 py-1.5">
                    {can ? (
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => toggle(m.month)}
                        className="inline-flex cursor-pointer items-center gap-1 font-medium text-brand hover:underline"
                      >
                        <ChevronRightIcon className={cn("size-4 transition-transform", isOpen && "rotate-90")} aria-hidden />
                        {m.label}
                      </button>
                    ) : (
                      <span className="pl-5">{m.label}</span>
                    )}
                  </td>
                  {m.cells.map((c, i) => (
                    <td key={i} className={td}>
                      {c}
                    </td>
                  ))}
                </tr>
                {isOpen &&
                  m.details.map((d) => (
                    <tr key={`${m.month}-${d.label}`} className="border-b text-muted-foreground">
                      <td className="py-1.5 pr-3 pl-10">{d.label}</td>
                      {d.cells.map((c, i) => (
                        <td key={i} className={td}>
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
              </Fragment>
            );
          })}
          {total && (
            <tr className="border-t-2 font-semibold">
              <td className="px-3 py-1.5">{total.label}</td>
              {total.cells.map((c, i) => (
                <td key={i} className={td}>
                  {c}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
