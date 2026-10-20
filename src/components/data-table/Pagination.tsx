"use client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUrlParams } from "./use-url-params";

// "Showing 1–25 of 80", rows per page (10 / 25 / 50 / 100) and Previous /
// Next, kept in the URL (?page=…&size=…). Shared by every table.
export function Pagination({ total, page, pageSize }: { total: number; page: number; pageSize: number }) {
  const { setParams, pending } = useUrlParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <div className="flex items-center gap-3">
        <span>{total === 0 ? "No results" : `Showing ${first}–${last} of ${total}`}</span>
        <label className="flex items-center gap-1.5">
          Rows per page
          <Select value={String(pageSize)} onValueChange={(v) => setParams({ size: v === "25" ? null : v })}>
            <SelectTrigger size="sm" aria-label="Rows per page" className="h-7 w-auto bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {[10, 25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
      <div className="flex items-center gap-2">
        <span>
          Page {Math.min(page, pages)} of {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || pending}
          onClick={() => setParams({ page: String(page - 1) })}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages || pending}
          onClick={() => setParams({ page: String(page + 1) })}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
