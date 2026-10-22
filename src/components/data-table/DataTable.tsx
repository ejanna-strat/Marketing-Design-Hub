"use client";

import { type ColumnDef, createColumnHelper, type RowData, tableFeatures, useTable } from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Pagination } from "./Pagination";
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
  rowHref,
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
  // Clicking anywhere on a row opens this page (owner, Oct 22), except on the
  // row's own links, buttons, dropdowns and pop-ups.
  rowHref?: (row: T) => string;
}) {
  const router = useRouter();
  const { get, setParams, pending } = useUrlParams();

  function openRow(e: React.MouseEvent<HTMLTableRowElement>, href: string) {
    const target = e.target as HTMLElement;
    // Pop-ups (dropdown lists, link editor) live outside the row on the page
    // but still pass their clicks up to it, so only clicks inside count.
    if (!e.currentTarget.contains(target)) return;
    if (target.closest("a, button, input, select, textarea, label, [role=combobox], [role=menu], [role=dialog]")) return;
    if (window.getSelection()?.toString()) return; // selecting text, not opening
    if (e.metaKey || e.ctrlKey) window.open(href, "_blank");
    else router.push(href);
  }
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
                <TableRow
                  key={row.id}
                  onClick={rowHref ? (e) => openRow(e, rowHref(row.original)) : undefined}
                  className={cn(rowHref && "cursor-pointer")}
                >
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

      <Pagination total={total} page={page} pageSize={pageSize} />
    </div>
  );
}
