"use client";

import { ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { formatDate } from "@/lib/dates";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useUrlParams } from "./use-url-params";

export type FilterConfig = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
};

// Comma-separated values in the URL (?status=in_progress,for_review).
const split = (v: string) => (v ? v.split(",").filter(Boolean) : []);

// Search box, tick-box filters (pick several) and a request-date range, all
// kept in the URL.
export function DataTableToolbar({
  filters,
  searchPlaceholder = "Search ID, title, type, output or designer",
  showSearch = true,
  showDates = true,
}: {
  filters: FilterConfig[];
  searchPlaceholder?: string;
  showSearch?: boolean;
  showDates?: boolean;
}) {
  const { get, setParams } = useUrlParams();
  const [q, setQ] = useState(get("q"));
  const keys = [...(showSearch ? ["q"] : []), ...(showDates ? ["from", "to"] : []), ...filters.map((f) => f.key)];

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
  if (get("from")) chips.push({ id: "from", label: "From", value: formatDate(get("from")), remove: () => setParams({ from: null }) });
  if (get("to")) chips.push({ id: "to", label: "To", value: formatDate(get("to")), remove: () => setParams({ to: null }) });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        {showSearch && (
          <form
            className="relative w-full sm:w-80"
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

        {showDates && (
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">Request date</span>
            <Input
              type="date"
              aria-label="Request date from"
              value={get("from")}
              max={get("to") || undefined}
              onChange={(e) => setParams({ from: e.target.value || null })}
              className="w-36 bg-background"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              aria-label="Request date to"
              value={get("to")}
              min={get("from") || undefined}
              onChange={(e) => setParams({ to: e.target.value || null })}
              className="w-36 bg-background"
            />
          </div>
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
          {filter.options.map((o) => {
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
                  {o.label}
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
