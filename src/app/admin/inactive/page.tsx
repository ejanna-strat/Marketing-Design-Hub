import { DataTableToolbar } from "@/components/data-table/DataTableToolbar";
import { RememberList } from "@/components/data-table/ListMemory";
import { requireStaff } from "@/lib/auth";
import { SummaryBox, shareOf } from "@/components/SummaryBox";
import { facetsInView, listRequests, parseListParams } from "@/lib/requests/list";
import { INACTIVE_STATUSES, statusFilterOptions } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";
import { formatPeso } from "@/lib/money";
import { PipelineTable } from "../pipeline/PipelineTable";
import { DealSwitch } from "./DealSwitch";

// Cancelled and Returned requests, kept out of the pipeline (owner, Oct 20).
export default async function InactiveRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStaff();
  const params = parseListParams(await searchParams);
  const supabase = await createClient();

  const options = { searchRequester: true, scope: "inactive" } as const;
  const [{ rows, total }, facets, designers, all] = await Promise.all([
    listRequests(supabase, params, options),
    facetsInView(supabase, params, options),
    supabase.from("designers").select("id, display_name, active").order("display_name"),
    supabase.from("requests").select("status, is_deal, deal_size").in("status", [...INACTIVE_STATUSES]),
  ]);
  // Who cancelled or returned each request on this page: the latest
  // Returned / Cancelled entry in its activity log (owner, Oct 21).
  const { data: closings } = rows.length
    ? await supabase
        .from("activity_log")
        .select("request_id, created_at, actor:profiles(full_name)")
        .in("request_id", rows.map((r) => r.id))
        .or("action.in.(returned,cancelled),and(action.eq.status,to_value.in.(cancelled,rejected))")
        .order("created_at", { ascending: false })
    : { data: [] };
  const closedBy: Record<string, string> = {};
  for (const c of closings ?? []) {
    if (!(c.request_id in closedBy)) closedBy[c.request_id] = c.actor?.full_name ?? "—";
  }

  const inactive = all.data ?? [];
  const returned = inactive.filter((r) => r.status === "rejected").length;
  const cancelled = inactive.filter((r) => r.status === "cancelled").length;
  const withDeals = inactive.filter((r) => r.is_deal);
  const dealSize = withDeals.reduce((n, r) => n + (r.deal_size ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Inactive Requests</h1>
        <p className="text-muted-foreground">Cancelled and returned requests.</p>
      </div>
      <RememberList label="Inactive Requests" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryBox title="Total inactive" value={inactive.length} />
        <SummaryBox title="Returned" value={returned} rate={shareOf(returned, inactive.length)} />
        <SummaryBox title="Cancelled" value={cancelled} rate={shareOf(cancelled, inactive.length)} />
        {/* Owner, Oct 23. */}
        <SummaryBox
          title="With deals"
          value={withDeals.length}
          rate={shareOf(withDeals.length, inactive.length)}
          lines={[`Deal size: ${dealSize ? formatPeso(dealSize) : "—"}`]}
        />
      </div>
      <DataTableToolbar
        leading={<DealSwitch />}
        filters={[
          {
            key: "status",
            label: "Status",
            options: statusFilterOptions(INACTIVE_STATUSES, facets.status),
          },
        ]}
      />
      <PipelineTable
        rows={rows}
        total={total}
        page={params.page}
        pageSize={params.pageSize}
        designers={(designers.data ?? []).map((d) => ({ id: d.id, name: d.display_name, active: d.active }))}
        viewer={{ designerId: user.designerId, isManager: user.isManager, isAdmin: user.isAdmin }}
        extra="inactive"
        // With deals: Deal Name and Deal Size after Request Title (owner, Oct 23).
        dealColumns={params.deal === "yes"}
        closedBy={closedBy}
      />
    </div>
  );
}
