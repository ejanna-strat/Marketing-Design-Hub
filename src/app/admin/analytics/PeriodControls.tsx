"use client";

import { useState } from "react";
import { useUrlParams } from "@/components/data-table/use-url-params";
import { CalendarIcon } from "lucide-react";
import { RangeCalendar } from "@/components/data-table/RangeCalendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/dates";
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
  // Picking "Custom range…" opens the calendar straight away.
  const [justPicked, setJustPicked] = useState(false);

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
                setJustPicked(true);
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
          {custom && <CustomRange autoOpen={justPicked} from={from} to={to} onPick={(a, b) => setParams({ month: null, from: a, to: b })} />}
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

// Custom range: one calendar, start date then end date (owner, Oct 22).
function CustomRange({
  autoOpen,
  from,
  to,
  onPick,
}: {
  autoOpen: boolean;
  from: string;
  to: string;
  onPick: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(autoOpen);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" aria-label="Custom range" className="bg-background font-normal">
          <CalendarIcon className="text-muted-foreground" />
          {from && to ? `${formatDate(from)} – ${formatDate(to)}` : "Pick dates"}
        </Button>
      </PopoverTrigger>
      {/* The month dropdown hands focus back as it closes; that mustn't
          close the calendar it just opened (clicking outside still does). */}
      <PopoverContent align="start" className="w-auto p-0" onFocusOutside={(e) => e.preventDefault()}>
        <RangeCalendar
          from={from}
          to={to}
          onPick={(a, b) => {
            onPick(a, b);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
