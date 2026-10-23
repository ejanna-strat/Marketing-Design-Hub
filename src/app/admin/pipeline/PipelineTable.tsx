"use client";

import Link from "next/link";
import { useMemo } from "react";
import { columnHelper, DataTable, type TableColumn } from "@/components/data-table/DataTable";
import { Highlight } from "@/components/data-table/Highlight";
import { StarsDisplay } from "@/components/feedback/Stars";
import { OutputLink } from "@/components/LinkifiedText";
import { StatusBadge } from "@/components/StatusBadge";
import { type DesignerOption, DesignerSelect, LinkEditor, StatusSelect } from "@/components/requests/editors";
import { formatDate } from "@/lib/dates";
import { one, overallRating } from "@/lib/feedback";
import { formatPeso } from "@/lib/money";
import type { RequestListRow } from "@/lib/requests/list";
import { designerChoice, type DesignerViewer } from "@/lib/statuses";

const col = columnHelper<RequestListRow>();
const INACTIVE = new Set(["cancelled", "rejected"]);
const muted = <span className="text-muted-foreground">—</span>;

// The staff request table, shared by the Design Pipeline, Pendings, Deal
// Requests ("deal": adds Deal Name and Deal Size) and Inactive Requests
// ("inactive": adds the reason and last update).
export function PipelineTable({
  rows,
  total,
  page,
  pageSize,
  designers,
  viewer,
  extra,
  readOnly = false,
  closedBy,
  dealColumns: withDeals = false,
}: {
  rows: RequestListRow[];
  total: number;
  page: number;
  pageSize: number;
  designers: DesignerOption[];
  // Who may change the designer (see designerChoice in statuses.ts).
  viewer: DesignerViewer;
  extra?: "deal" | "inactive";
  // Deal Requests (owner, Oct 21): nothing editable in the table; changes are
  // made on the request page.
  readOnly?: boolean;
  // Inactive Requests: who cancelled or returned each request, by request id.
  closedBy?: Record<string, string>;
  // Show Deal Name and Deal Size (Deal Requests always; Inactive Requests'
  // With deals view).
  dealColumns?: boolean;
}) {
  const columns = useMemo(() => {
    const dealColumns: TableColumn<RequestListRow>[] =
      extra === "deal" || withDeals
        ? [
            col.accessor("deal_name", { header: "Deal Name", cell: (info) => <Highlight text={info.getValue()} /> }),
            col.accessor("deal_size", { header: "Deal Size (PHP)", cell: (info) => formatPeso(info.getValue()) }),
          ]
        : [];
    const inactiveColumns: TableColumn<RequestListRow>[] =
      extra === "inactive"
        ? [
            // Returned: the reviewer's reason. Cancelled: the requester's reason, if they cancelled it.
            col.accessor((r) => (r.status === "rejected" ? r.return_reason : r.cancel_reason) ?? "", {
              id: "return_reason",
              header: "Reason",
              cell: (info) => info.getValue() || muted,
            }),
            col.display({
              id: "closed_by",
              header: "Cancelled / Returned By",
              cell: (info) => closedBy?.[info.row.original.id] ?? muted,
            }),
            col.accessor("updated_at", { header: "Last Updated", cell: (info) => formatDate(info.getValue()) }),
            col.accessor("is_deal", { header: "Deal Associated", cell: (info) => (info.getValue() ? "Yes" : "No") }),
          ]
        : [];
    // Inactive Requests leaves out Link to Output and Overall Feedback (owner, Oct 21).
    const closingColumns: TableColumn<RequestListRow>[] =
      extra === "inactive"
        ? []
        : [
            col.accessor("link_to_output", {
              header: "Link to Output",
              cell: (info) =>
                readOnly ? (
                  <OutputLink value={info.getValue()} />
                ) : (
                  <LinkEditor
                    requestId={info.row.original.id}
                    value={info.getValue()}
                    locked={INACTIVE.has(info.row.original.status)}
                  />
                ),
            }),
            col.display({
              id: "feedback",
              header: "Overall Feedback",
              cell: (info) => {
                const f = one(info.row.original.feedback);
                return f ? <StarsDisplay value={overallRating(f)} /> : muted;
              },
            }),
          ];
    return col.columns([
      col.accessor("request_code", {
        header: "Request ID",
        cell: (info) => (
          <Link href={`/admin/requests/${info.getValue()}`} className="font-mono font-medium text-foreground">
            <Highlight text={info.getValue()} />
          </Link>
        ),
      }),
      col.accessor("created_at", { header: "Request Date", cell: (info) => formatDate(info.getValue()) }),
      col.accessor("date_needed", { header: "Date Needed", cell: (info) => formatDate(info.getValue()) }),
      col.accessor("title", { header: "Request Title", cell: (info) => <Highlight text={info.getValue()} /> }),
      ...dealColumns,
      col.accessor((r) => r.request_type?.name ?? "", {
        id: "type",
        header: "Type of Request",
        cell: (info) => <Highlight text={info.getValue()} />,
      }),
      col.accessor("output_needed", { header: "Output Needed", cell: (info) => <Highlight text={info.getValue()} /> }),
      col.accessor("status", {
        header: "Status",
        cell: (info) => {
          const r = info.row.original;
          const note =
            r.assigned_designer_id && r.designer_response === "pending"
              ? `Waiting for ${r.designer?.display_name ?? "the designer"} to accept`
              : !r.assigned_designer_id && r.status === "new_request" && r.reassign_reason
                ? `Reassignment requested: ${r.reassign_reason}`
                : null;
          return (
            <div className="space-y-1">
              {readOnly ? (
                <StatusBadge status={info.getValue()} />
              ) : (
                <StatusSelect
                  requestId={r.id}
                  value={info.getValue()}
                  hasDesigner={!!r.assigned_designer_id}
                  hasLink={!!r.link_to_output}
                  accepted={!!r.assigned_designer_id && r.designer_response === "accepted"}
                />
              )}
              {note && <p className="max-w-56 text-xs whitespace-normal text-muted-foreground">{note}</p>}
            </div>
          );
        },
      }),
      ...inactiveColumns,
      col.accessor("assigned_designer_id", {
        id: "designer",
        header: "Assigned Designer",
        cell: (info) =>
          !readOnly && (viewer.designerId || viewer.isManager || viewer.isAdmin) ? (
            <DesignerSelect
              requestId={info.row.original.id}
              value={info.getValue()}
              designers={designers}
              selfId={viewer.designerId}
              {...designerChoice(info.row.original.status, info.getValue(), viewer)}
            />
          ) : info.row.original.designer?.display_name ? (
            <Highlight text={info.row.original.designer.display_name} />
          ) : (
            muted
          ),
      }),
      col.accessor("requester_name", { header: "Requester's Name", cell: (info) => <Highlight text={info.getValue()} /> }),
      col.accessor((r) => r.team?.name ?? "", { id: "team", header: "Requester's Team" }),
      // Requester's Email is on the request page, not in the tables (owner, Oct 21).
      ...closingColumns,
    ]);
  }, [viewer, designers, extra, readOnly, closedBy, withDeals]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      rowHref={(r) => `/admin/requests/${r.request_code}`}
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
        "deal_name",
        "deal_size",
      ]}
      columnClassNames={{
        title: "min-w-52 whitespace-normal",
        type: "min-w-36 whitespace-normal",
        output_needed: "min-w-36 whitespace-normal",
        link_to_output: "min-w-32",
        deal_name: "min-w-40 whitespace-normal",
        return_reason: "min-w-56 whitespace-normal",
      }}
    />
  );
}
