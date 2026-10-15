"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUrlParams } from "./use-url-params";

export type FilterConfig = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
};

const ALL = "__all__";

// Search box, dropdown filters and a request-date range, all kept in the URL.
export function DataTableToolbar({
  filters,
  searchPlaceholder = "Search by Request ID or title",
}: {
  filters: FilterConfig[];
  searchPlaceholder?: string;
}) {
  const { get, setParams } = useUrlParams();
  const [q, setQ] = useState(get("q"));
  const keys = ["q", "from", "to", ...filters.map((f) => f.key)];
  const active = keys.some((k) => get(k));

  return (
    <div className="flex flex-wrap items-end gap-2">
      <form
        className="relative w-full sm:w-72"
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

      {filters.map((f) => (
        <Select key={f.key} value={get(f.key) || ALL} onValueChange={(v) => setParams({ [f.key]: v === ALL ? null : v })}>
          <SelectTrigger aria-label={f.label} className="w-auto max-w-56 bg-background">
            <span className="text-muted-foreground">{f.label}:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={ALL}>All</SelectItem>
            {f.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

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

      {active && (
        <Button
          variant="ghost"
          onClick={() => {
            setQ("");
            setParams(Object.fromEntries(keys.map((k) => [k, null])));
          }}
        >
          <XIcon />
          Clear filters
        </Button>
      )}
    </div>
  );
}
