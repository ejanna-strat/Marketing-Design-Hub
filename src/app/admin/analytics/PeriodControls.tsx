"use client";

import { useState } from "react";
import { useUrlParams } from "@/components/data-table/use-url-params";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const CUSTOM = "custom";

// Tabs (Monthly report / Month on Month) and the period picker for each
// (owner, Oct 21). Everything lives in the URL so a report can be shared.
export function PeriodControls({
  tab,
  months,
  month,
  from,
  to,
  years,
  year,
}: {
  tab: "monthly" | "mom";
  months: { value: string; label: string }[]; // newest first
  month: string | null; // null = custom range
  from: string;
  to: string;
  years: string[];
  year: string;
}) {
  const { setParams, pending } = useUrlParams();
  const [custom, setCustom] = useState(month === null);

  const tabs = [
    { value: "monthly", label: "Monthly report" },
    { value: "mom", label: "Month on Month" },
  ] as const;

  return (
    <div className={cn("space-y-4", pending && "opacity-60")}>
      <div role="tablist" aria-label="Report" className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setParams({ tab: t.value === "monthly" ? null : t.value, month: null, from: null, to: null, year: null })}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
              tab === t.value
                ? "border-brand font-medium text-brand"
                : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "monthly" ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Period</span>
          <Select
            value={custom ? CUSTOM : (month ?? "")}
            onValueChange={(v) => {
              if (v === CUSTOM) {
                setCustom(true);
                return;
              }
              setCustom(false);
              setParams({ month: v, from: null, to: null });
            }}
          >
            <SelectTrigger aria-label="Month" className="w-48 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM}>Custom range…</SelectItem>
            </SelectContent>
          </Select>
          {custom && (
            <>
              <Input
                type="date"
                aria-label="From"
                defaultValue={from}
                max={to}
                className="w-40 bg-background"
                onChange={(e) => e.target.value && setParams({ month: null, from: e.target.value, to })}
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                aria-label="To"
                defaultValue={to}
                min={from}
                className="w-40 bg-background"
                onChange={(e) => e.target.value && setParams({ month: null, from, to: e.target.value })}
              />
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Year</span>
          <Select value={year} onValueChange={(v) => setParams({ year: v })}>
            <SelectTrigger aria-label="Year" className="w-32 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
