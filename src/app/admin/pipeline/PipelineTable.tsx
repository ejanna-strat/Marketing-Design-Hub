"use client";

import Link from "next/link";
import { useMemo } from "react";
import { columnHelper, DataTable } from "@/components/data-table/DataTable";
import { type DesignerOption, DesignerSelect, LinkEditor, StatusSelect } from "@/components/requests/editors";
import { formatDate } from "@/lib/dates";
import type { RequestListRow } from "@/lib/requests/list";

const col = columnHelper<RequestListRow>();
const muted = <span className="text-muted-foreground">—</span>;

export function PipelineTable({
  rows,
  total,
  page,
  pageSize,
  designers,
  canAssign,
}: {
  rows: RequestListRow[];
  total: number;
  page: number;
  pageSize: number;
  designers: DesignerOption[];
  // Admins and Lead Designers can assign designers; Designers see the name.
  canAssign: boolean;
}) {
  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("request_code", {
          header: "Request ID",
          cell: (info) => (
            <Link
              href={`/admin/requests/${info.getValue()}`}
              className="font-mono font-medium text-brand hover:underline"
            >
              {info.getValue()}
            </Link>
          ),
        }),
        col.accessor("created_at", { header: "Request Date", cell: (info) => formatDate(info.getValue()) }),
        col.accessor("date_needed", { header: "Date Needed", cell: (info) => formatDate(info.getValue()) }),
        col.accessor("title", { header: "Request Title" }),
        col.accessor((r) => r.request_type?.name ?? "", { id: "type", header: "Type of Request" }),
        col.accessor("output_needed", { header: "Output Needed" }),
        col.accessor("status", {
          header: "Status",
          cell: (info) => <StatusSelect requestId={info.row.original.id} value={info.getValue()} />,
        }),
        col.accessor("assigned_designer_id", {
          id: "designer",
          header: "Assigned Designer",
          cell: (info) =>
            canAssign ? (
              <DesignerSelect requestId={info.row.original.id} value={info.getValue()} designers={designers} />
            ) : (
              info.row.original.designer?.display_name ?? muted
            ),
        }),
        col.accessor("requester_name", { header: "Requester's Name" }),
        col.accessor((r) => r.team?.name ?? "", { id: "team", header: "Requester's Team" }),
        col.accessor("requester_email", { header: "Requester's Email" }),
        col.accessor("link_to_output", {
          header: "Link to Output",
          cell: (info) => <LinkEditor requestId={info.row.original.id} value={info.getValue()} />,
        }),
        // Feedback arrives in Phase 3.
        col.display({ id: "feedback", header: "Overall Feedback", cell: () => muted }),
      ]),
    [canAssign, designers],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      sortable={[
        "request_code",
        "created_at",
        "date_needed",
        "title",
        "output_needed",
        "status",
        "requester_name",
        "requester_email",
      ]}
      columnClassNames={{
        title: "min-w-52 whitespace-normal",
        type: "min-w-36 whitespace-normal",
        output_needed: "min-w-36 whitespace-normal",
        link_to_output: "min-w-32",
      }}
    />
  );
}
