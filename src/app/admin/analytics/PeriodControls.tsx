"use client";

import { useState } from "react";
import { useUrlParams } from "@/components/data-table/use-url-params";
import { CalendarIcon, ChevronDownIcon, ListIcon } from "lucide-react";
import { RangeCalendar } from "@/components/data-table/RangeCalendar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/dates";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const CUSTOM = "custom";

// Tabs (Monthly report / Month on Month), the period picker and Jump to, in
// one slim bar that stays at the top while scrolling (owner, Oct 23). The
// band is the page's own colour with no border and fades into the page at
// the bottom (matches the admin layout's bg-muted/30). In a narrow space the
// tab names shorten and Jump to becomes one dropdown, so it stays one row.
// Everything lives in the URL so a report can be shared.
export function PeriodControls({
  tab,
  months,
  month,
  from,
  to,
  years,
  year,
  sections,
}: {
  tab: "monthly" | "mom";
  months: { value: string; label: string }[]; // newest first
  month: string | null; // null = custom range
  from: string;
  to: string;
  years: string[];
  year: string;
  sections: { id: string; label: string }[];
}) {
  const { setParams, pending } = useUrlParams();
  const [custom, setCustom] = useState(month === null);
  // Picking "Custom range…" opens the calendar straight away.
  const [justPicked, setJustPicked] = useState(false);

  const tabs = [
    { value: "monthly", label: "Monthly report", short: "Monthly" },
    { value: "mom", label: "Month on Month", short: "MoM" },
  ] as const;

  return (
    <div className="@container sticky top-14 z-30 -mx-1 bg-(--page-bg) px-1 py-2 text-sm [--page-bg:color-mix(in_srgb,var(--muted)_30%,var(--background))] after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-5 after:bg-linear-to-b after:from-(--page-bg) after:to-transparent">
      <div className={cn("flex flex-wrap items-center gap-1.5 @[40rem]:gap-2", pending && "opacity-60")}>
        <div role="tablist" aria-label="Report" className="inline-flex shrink-0 gap-0.5 rounded-full border bg-background p-1 shadow-sm">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              aria-label={t.label}
              onClick={() => setParams({ tab: t.value === "monthly" ? null : t.value, month: null, from: null, to: null, year: null })}
              className={cn(
                "h-7 cursor-pointer rounded-full px-2.5 font-medium whitespace-nowrap @[40rem]:px-3 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                tab === t.value ? "bg-brand text-white shadow-sm" : "text-foreground/80 hover:bg-brand-soft hover:text-brand",
              )}
            >
              <span className="@[40rem]:hidden">{t.short}</span>
              <span className="hidden @[40rem]:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {tab === "monthly" ? (
          <div className="flex items-center gap-2">
            <span className="hidden text-muted-foreground @[40rem]:inline">Period</span>
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
              <SelectTrigger size="sm" aria-label="Month" className="w-34 bg-background @[40rem]:w-44">
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
          <div className="flex items-center gap-2">
            <span className="hidden text-muted-foreground @[40rem]:inline">Year</span>
            <Select value={year} onValueChange={(v) => setParams({ year: v })}>
              <SelectTrigger size="sm" aria-label="Year" className="w-24 bg-background">
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

        <nav aria-label="Sections" className="ml-auto flex items-center">
          {/* Wide: one button per section. */}
          <div className={cn("hidden items-center gap-1", custom && tab === "monthly" ? "@[72rem]:flex" : "@[58rem]:flex")}>
            <span className="mr-1 text-muted-foreground">Jump to:</span>
            {sections.map((j) => (
              <a
                key={j.id}
                href={`#${j.id}`}
                className="rounded-full border bg-background px-3 py-1 font-medium text-brand transition-colors hover:border-brand/60 hover:bg-brand-soft"
              >
                {j.label}
              </a>
            ))}
          </div>
          {/* Narrow: one Jump to dropdown. */}
          <div className={custom && tab === "monthly" ? "@[72rem]:hidden" : "@[58rem]:hidden"}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Jump to"
                  className="rounded-full bg-background px-2.5 font-medium text-brand"
                >
                  {/* Phones: just a list icon, so the month fits in full. */}
                  <ListIcon className="@[26rem]:hidden" />
                  <span className="hidden @[26rem]:inline">Jump to</span>
                  <ChevronDownIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {sections.map((j) => (
                  <DropdownMenuItem key={j.id} asChild>
                    <a href={`#${j.id}`}>{j.label}</a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>
      </div>
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
