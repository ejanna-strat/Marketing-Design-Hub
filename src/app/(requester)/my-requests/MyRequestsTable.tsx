"use client";

import Link from "next/link";
import { columnHelper, DataTable } from "@/components/data-table/DataTable";
import { OutputLink } from "@/components/LinkifiedText";
import { StarsDisplay } from "@/components/feedback/Stars";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/dates";
import { one, overallRating } from "@/lib/feedback";
import type { RequestListRow } from "@/lib/requests/list";

const col = columnHelper<RequestListRow>();

const columns = col.columns([
  col.accessor("request_code", {
    header: "Request ID",
    cell: (info) => (
      <Link href={`/my-requests/${info.getValue()}`} className="font-mono font-medium text-brand hover:underline">
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
    cell: (info) => <StatusBadge status={info.getValue()} audience="requester" />,
  }),
  col.accessor((r) => r.designer?.display_name ?? "", {
    id: "designer",
    header: "Assigned Designer",
    cell: (info) => info.getValue() || <span className="text-muted-foreground">—</span>,
  }),
  col.accessor("link_to_output", { header: "Link to Output", cell: (info) => <OutputLink value={info.getValue()} /> }),
  col.display({
    id: "feedback",
    header: "Overall Feedback",
    cell: (info) => {
      const r = info.row.original;
      const f = one(r.feedback);
      if (f) return <StarsDisplay value={overallRating(f)} />;
      if (r.status === "completed") {
        return (
          <Link href={`/feedback/${r.request_code}`} className="font-medium text-brand hover:underline">
            Share feedback
          </Link>
        );
      }
      return <span className="text-muted-foreground">—</span>;
    },
  }),
]);

export function MyRequestsTable({
  rows,
  total,
  page,
  pageSize,
}: {
  rows: RequestListRow[];
  total: number;
  page: number;
  pageSize: number;
}) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      sortable={["request_code", "created_at", "date_needed", "title", "output_needed", "status"]}
      columnClassNames={{
        title: "min-w-48 whitespace-normal",
        output_needed: "min-w-36 whitespace-normal",
        type: "min-w-36 whitespace-normal",
      }}
      emptyMessage="No requests yet. Your design requests will show up here."
    />
  );
}
