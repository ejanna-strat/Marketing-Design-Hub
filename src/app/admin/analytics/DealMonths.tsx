"use client";

import { ChevronRightIcon } from "lucide-react";
import { Fragment, useState } from "react";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";

type Month = { month: string; label: string; requests: number; size: number; byType: { label: string; requests: number; size: number }[] };

// Month on Month Deal Requests (owner, Oct 23): deal requests and deal size
// per month; click a month to see its breakdown by type of request.
export function DealMonths({ months, year, total }: { months: Month[]; year: string; total: { requests: number; size: number } }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (m: string) =>
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  // Compact (owner, Oct 23): tighter rows, and only as wide as it needs to be.
  const td = "px-3 py-1.5 text-right tabular-nums whitespace-nowrap";
  return (
    <div className="overflow-x-auto">
      <table className="zebra w-full max-w-xl text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="px-3 py-1.5 text-left font-medium">Month</th>
            <th className="px-3 py-1.5 text-right font-medium whitespace-nowrap">Requests with deals</th>
            <th className="px-3 py-1.5 text-right font-medium whitespace-nowrap">Total deal size</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => {
            const can = m.byType.length > 0;
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
                  <td className={td}>{m.requests}</td>
                  <td className={td}>{m.size ? formatPeso(m.size) : "—"}</td>
                </tr>
                {isOpen &&
                  m.byType.map((t) => (
                    <tr key={`${m.month}-${t.label}`} className="border-b text-muted-foreground">
                      <td className="py-1.5 pr-3 pl-10">{t.label}</td>
                      <td className={td}>{t.requests}</td>
                      <td className={td}>{formatPeso(t.size)}</td>
                    </tr>
                  ))}
              </Fragment>
            );
          })}
          <tr className="border-t-2 font-semibold">
            <td className="px-3 py-1.5">{year} total</td>
            <td className={td}>{total.requests}</td>
            <td className={td}>{total.size ? formatPeso(total.size) : "—"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
