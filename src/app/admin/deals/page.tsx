import { DataTableToolbar } from "@/components/data-table/DataTableToolbar";
import { RememberList } from "@/components/data-table/ListMemory";
import { ViewSwitch } from "@/components/data-table/ViewSwitch";
import { requireStaff } from "@/lib/auth";
import { formatPeso } from "@/lib/money";
import { SummaryBox, shareOf } from "@/components/SummaryBox";
import { listRequests, parseListParams, statusesInView } from "@/lib/requests/list";
import { INACTIVE_STATUSES, PENDING_TABS, statusFilterOptions } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";
import { PipelineTable } from "../pipeline/PipelineTable";

// Requests associated with a deal (owner, Oct 20): the pipeline with Deal
// Name and Deal Size (PHP) columns.
export default async function DealRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff();
  const params = parseListParams(await searchParams);
  const supabase = await createClient();

  const options = { searchRequester: true, scope: "pipeline", dealsOnly: true } as const;
  const [{ rows, total }, present, teams, types, sums] = await Promise.all([
    listRequests(supabase, params, options),
    statusesInView(supabase, params, options),
    supabase.from("teams").select("id, name").order("sort_order"),
    supabase.from("request_types").select("id, name").order("sort_order"),
    supabase.from("requests").select("status, deal_size").eq("is_deal", true).not("status", "in", `(${INACTIVE_STATUSES.join(",")})`),
  ]);
  // Summary boxes (owner, Oct 21): all active deal requests, then the pending
  // and completed ones with their deal size and share of the total.
  const deals = sums.data ?? [];
  const size = (list: typeof deals) => list.reduce((n, r) => n + (r.deal_size ?? 0), 0);
  const pendingStatuses: string[] = PENDING_TABS.map((t) => t.status);
  const pending = deals.filter((r) => pendingStatuses.includes(r.status));
  const completed = deals.filter((r) => r.status === "completed");

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Deal Requests</h1>
        <p className="text-muted-foreground">Design requests associated with a deal.</p>
      </div>
      <RememberList label="Deal Requests" />
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryBox
          title="Requests with associated deals"
          value={deals.length}
          lines={[`Total deal size: ${formatPeso(size(deals))}`]}
        />
        <SummaryBox
          title="Pending"
          value={pending.length}
          rate={shareOf(pending.length, deals.length)}
          lines={[`Deal size: ${formatPeso(size(pending))}`]}
        />
        <SummaryBox
          title="Completed"
          value={completed.length}
          rate={shareOf(completed.length, deals.length)}
          lines={[`Deal size: ${formatPeso(size(completed))}`]}
        />
      </div>
      <DataTableToolbar
        leading={<ViewSwitch />}
        searchPlaceholder="Search ID, title, deal, requester, type, output or designer"
        filters={[
          {
            key: "status",
            label: "Status",
            options: statusFilterOptions(null, present),
          },
          { key: "team", label: "Team", options: (teams.data ?? []).map((t) => ({ value: t.id, label: t.name })) },
          { key: "type", label: "Type", options: (types.data ?? []).map((t) => ({ value: t.id, label: t.name })) },
        ]}
      />
      <PipelineTable
        rows={rows}
        total={total}
        page={params.page}
        pageSize={params.pageSize}
        designers={[]}
        canAssign={false}
        readOnly
        extra="deal"
      />
    </div>
  );
}
