import { DataTableToolbar } from "@/components/data-table/DataTableToolbar";
import { RememberList } from "@/components/data-table/ListMemory";
import { ViewSwitch } from "@/components/data-table/ViewSwitch";
import { requireStaff } from "@/lib/auth";
import { formatPeso } from "@/lib/money";
import { listRequests, parseListParams } from "@/lib/requests/list";
import { INACTIVE_STATUSES, statusOptions } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";
import { PipelineTable } from "../pipeline/PipelineTable";

export const metadata = { title: "Deal Requests" };

// Requests associated with a deal (owner, Oct 20): the pipeline with Deal
// Name and Deal Size (PHP) columns.
export default async function DealRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStaff();
  const params = parseListParams(await searchParams);
  const supabase = await createClient();

  const [{ rows, total }, designers, teams, types, sums] = await Promise.all([
    listRequests(supabase, params, { searchRequester: true, scope: "pipeline", dealsOnly: true }),
    supabase.from("designers").select("id, display_name, active").order("display_name"),
    supabase.from("teams").select("id, name").order("sort_order"),
    supabase.from("request_types").select("id, name").order("sort_order"),
    supabase.from("requests").select("deal_size").eq("is_deal", true).not("status", "in", `(${INACTIVE_STATUSES.join(",")})`),
  ]);
  const totalSize = (sums.data ?? []).reduce((n, r) => n + (r.deal_size ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Deal Requests</h1>
        <p className="text-muted-foreground">
          Design requests associated with a deal · {(sums.data ?? []).length} active requests · {formatPeso(totalSize)} in deals
        </p>
      </div>
      <RememberList label="Deal Requests" />
      <ViewSwitch />
      <DataTableToolbar
        searchPlaceholder="Search ID, title, deal, requester, type, output or designer"
        filters={[
          {
            key: "status",
            label: "Status",
            options: statusOptions().filter((o) => !(INACTIVE_STATUSES as readonly string[]).includes(o.value)),
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
        designers={(designers.data ?? []).map((d) => ({ id: d.id, name: d.display_name, active: d.active }))}
        canAssign={user.isManager}
        extra="deal"
      />
    </div>
  );
}
