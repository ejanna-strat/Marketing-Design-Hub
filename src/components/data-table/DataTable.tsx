"use client";

import { type ColumnDef, createColumnHelper, type RowData, tableFeatures, useTable } from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useUrlParams } from "./use-url-params";

// The table runs in "manual" mode: the server already paged, sorted and
// filtered the rows, so TanStack only lays out columns and cells.
export const tableFeatureSet = tableFeatures({});
export type TableColumn<T extends RowData> = ColumnDef<typeof tableFeatureSet, T, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export const columnHelper = <T extends RowData>() => createColumnHelper<typeof tableFeatureSet, T>();

export function DataTable<T extends { id: string }>({
  columns,
  data,
  total,
  page,
  pageSize,
  sortable = [],
  defaultSort = "created_at",
  columnClassNames = {},
  emptyMessage = "No requests found.",
}: {
  columns: TableColumn<T>[];
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  // Column ids that can be sorted (each must be a sortable server column).
  sortable?: string[];
  defaultSort?: string;
  columnClassNames?: Record<string, string>;
  emptyMessage?: string;
}) {
  const { get, setParams, pending } = useUrlParams();
  const table = useTable({
    features: tableFeatureSet,
    columns,
    data,
    getRowId: (row) => row.id,
  });

  const sort = get("sort") || defaultSort;
  const dir = get("dir") === "asc" ? "asc" : "desc";

  function toggleSort(id: string) {
    if (sort === id) setParams({ sort: id, dir: dir === "asc" ? "desc" : "asc" });
    else setParams({ sort: id, dir: id === "created_at" ? "desc" : "asc" });
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  return (
    <div className="space-y-3">
      <div className={cn("overflow-hidden rounded-xl border bg-background transition-opacity", pending && "opacity-60")}>
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  const id = header.column.id;
                  const canSort = sortable.includes(id);
                  const active = sort === id;
                  const Icon = !active ? ArrowUpDownIcon : dir === "asc" ? ArrowUpIcon : ArrowDownIcon;
                  return (
                    <TableHead
                      key={header.id}
                      className={cn("text-xs font-semibold whitespace-nowrap", columnClassNames[id])}
                      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(id)}
                          className="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted hover:text-foreground"
                        >
                          <table.FlexRender header={header} />
                          <Icon className={cn("size-3.5", !active && "opacity-40")} />
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id} className={cn("align-top", columnClassNames[cell.column.id])}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total === 0 ? "No results" : `Showing ${first}–${last} of ${total}`}
        </span>
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
    </div>
  );
}
