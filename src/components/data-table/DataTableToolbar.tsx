"use client";

import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { formatDate } from "@/lib/dates";
import { Input } from "@/components/ui/input";
import { RangeCalendar } from "./RangeCalendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useUrlParams } from "./use-url-params";

export type FilterConfig = {
  key: string;
  label: string;
  // disabled: nothing matches it in the current view, so it's hidden (unless
  // ticked). count: how many items you'd see with it ticked.
  options: { value: string; label: string; disabled?: boolean; count?: number }[];
};

// An on/off chip, e.g. "Has comments" (?comments=1). count: how many items
// it would show.
export type ToggleConfig = { key: string; label: string; count?: number };

// Comma-separated values in the URL (?status=in_progress,for_review).
const split = (v: string) => (v ? v.split(",").filter(Boolean) : []);

// Search box, tick-box filters (pick several) and a request-date range, all
// kept in the URL.
export function DataTableToolbar({
  filters,
  // Just "Search": it matches anything shown in the table (owner, Oct 21).
  searchPlaceholder = "Search",
  showSearch = true,
  showDates = true,
  leading,
  toggles = [],
}: {
  filters: FilterConfig[];
  toggles?: ToggleConfig[];
  // Shown first on the same row (e.g. the Open / On Hold / Completed / All switch).
  leading?: React.ReactNode;
  searchPlaceholder?: string;
  showSearch?: boolean;
  showDates?: boolean;
}) {
  const { get, setParams } = useUrlParams();
  const [q, setQ] = useState(get("q"));
  const keys = [...(showSearch ? ["q"] : []), ...(showDates ? ["from", "to"] : []), ...filters.map((f) => f.key), ...toggles.map((t) => t.key)];

  // One removable tag per active filter value.
  const chips: { id: string; label: string; value: string; remove: () => void }[] = [];
  if (get("q")) {
    chips.push({ id: "q", label: "Search", value: `“${get("q")}”`, remove: () => (setQ(""), setParams({ q: null })) });
  }
  for (const f of filters) {
    const selected = split(get(f.key));
    for (const v of selected) {
      chips.push({
        id: `${f.key}:${v}`,
        label: f.label,
        value: f.options.find((o) => o.value === v)?.label ?? v,
        remove: () => setParams({ [f.key]: selected.filter((x) => x !== v).join(",") || null }),
      });
    }
  }
  for (const t of toggles) {
    if (get(t.key)) chips.push({ id: t.key, label: "Show", value: t.label, remove: () => setParams({ [t.key]: null }) });
  }
  if (get("from")) chips.push({ id: "from", label: "From", value: formatDate(get("from")), remove: () => setParams({ from: null }) });
  if (get("to")) chips.push({ id: "to", label: "To", value: formatDate(get("to")), remove: () => setParams({ to: null }) });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {leading}
        {showSearch && (
          <form
            className="relative w-full sm:w-48"
            onSubmit={(e) => {
              e.preventDefault();
              setParams({ q: q.trim() || null });
            }}
          >
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Search"
              placeholder={searchPlaceholder}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if (e.target.value === "") setParams({ q: null });
              }}
              className="bg-background pl-8"
            />
          </form>
        )}

        {filters.map((f) => (
          <MultiFilter
            key={f.key}
            filter={f}
            selected={split(get(f.key))}
            onChange={(values) => setParams({ [f.key]: values.join(",") || null })}
          />
        ))}

        {toggles.map((t) => {
          const on = !!get(t.key);
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={on}
              onClick={() => setParams({ [t.key]: on ? null : "1" })}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                on ? "border-brand bg-brand text-white" : "border-input bg-background hover:bg-muted",
              )}
            >
              {on && <CheckIcon className="size-3.5" />}
              {t.label}
              {t.count !== undefined && (
                <span className={cn("text-xs tabular-nums", on ? "text-white/80" : "text-muted-foreground")}>{t.count}</span>
              )}
            </button>
          );
        })}

        {showDates && (
          <DateFilter
            from={get("from")}
            to={get("to")}
            onChange={(from, to) => setParams({ from: from || null, to: to || null })}
          />
        )}
      </div>
      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Active filters">
          {chips.map((c) => (
            <li
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand-soft py-0.5 pr-1 pl-2.5 text-xs"
            >
              <span className="text-muted-foreground">{c.label}:</span>
              <span className="font-medium">{c.value}</span>
              <button
                type="button"
                aria-label={`Remove ${c.label} filter ${c.value}`}
                onClick={c.remove}
                className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-brand/10 hover:text-foreground"
              >
                <XIcon className="size-3" />
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => {
                setQ("");
                setParams(Object.fromEntries(keys.map((k) => [k, null])));
              }}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-brand hover:bg-brand-soft"
            >
              <XIcon className="size-3" />
              Clear filters
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

// A filter button that opens a list of tick boxes; several can be ticked.
function MultiFilter({
  filter,
  selected,
  onChange,
}: {
  filter: FilterConfig;
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const summary =
    selected.length === 0
      ? "All"
      : selected.length === 1
        ? (filter.options.find((o) => o.value === selected[0])?.label ?? "1 selected")
        : `${selected.length} selected`;
  const visible = filter.options.filter((o) => !o.disabled || selected.includes(o.value));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={filter.label}
          className={cn(
            "flex h-8 max-w-60 items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            selected.length > 0 && "border-brand/50",
          )}
        >
          <span className="text-muted-foreground">{filter.label}:</span>
          <span className="truncate">{summary}</span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <ul className="max-h-72 space-y-0.5 overflow-y-auto" role="group" aria-label={filter.label}>
          {/* Options with nothing in view are hidden so the list stays short
              (owner, Oct 22); a ticked one stays so it can be unticked. */}
          {visible.length === 0 && (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">Nothing to filter in this view.</li>
          )}
          {visible.map((o) => {
            const id = `f-${filter.key}-${o.value}`;
            const on = selected.includes(o.value);
            return (
              <li key={o.value}>
                <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                  <Checkbox
                    id={id}
                    checked={on}
                    onCheckedChange={(next) =>
                      onChange(next === true ? [...selected, o.value] : selected.filter((v) => v !== o.value))
                    }
                  />
                  <span className="flex-1">{o.label}</span>
                  {o.count !== undefined && (
                    <span className="text-xs text-muted-foreground tabular-nums">{o.count}</span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-brand hover:bg-brand-soft"
          >
            Clear {filter.label.toLowerCase()}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Request date range in one filter button (keeps the toolbar on one row,
// owner, Oct 21).
function DateFilter({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const summary =
    from && to ? `${formatDate(from)} – ${formatDate(to)}` : from ? `From ${formatDate(from)}` : to ? `Until ${formatDate(to)}` : "All";
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Request date"
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            (from || to) && "border-brand/50",
          )}
        >
          <span className="text-muted-foreground">Request date:</span>
          <span className="truncate font-medium">{summary}</span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <RangeCalendar
          from={from}
          to={to}
          onPick={(a, b) => {
            onChange(a, b);
            setOpen(false);
          }}
        />
        {(from || to) && (
          <button
            type="button"
            onClick={() => {
              onChange("", "");
              setOpen(false);
            }}
            className="mx-2 mb-2 w-[calc(100%-1rem)] rounded-md px-2 py-1.5 text-left text-xs font-medium text-brand hover:bg-brand-soft"
          >
            Clear dates
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
