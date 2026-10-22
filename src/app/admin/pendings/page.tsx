import { DataTableToolbar } from "@/components/data-table/DataTableToolbar";
import { requireStaff } from "@/lib/auth";
import { RememberList } from "@/components/data-table/ListMemory";
import { designerFilterOptions, facetsInView, listRequests, parseListParams } from "@/lib/requests/list";
import { PENDING_TABS } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";
import { PipelineTable } from "../pipeline/PipelineTable";
import { PendingTabs } from "./PendingTabs";

// §7.2 #5: every open request, one tab per pending status. Status, Designer
// and Link to Output can be edited right here (same table as the pipeline).
export default async function PendingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStaff();
  const params = parseListParams(await searchParams);
  // One tab at a time; the first tab is the default.
  const current = PENDING_TABS.find((t) => t.status === params.status[0])?.status ?? "new_request";
  params.status = [current];
  const supabase = await createClient();

  const options = { searchRequester: true } as const;
  const [{ rows, total }, facets, counts, designers] = await Promise.all([
    listRequests(supabase, params, options),
    facetsInView(supabase, params, options),
    Promise.all(
      PENDING_TABS.map((t) =>
        supabase.from("requests").select("id", { count: "exact", head: true }).eq("status", t.status).then((r) => r.count ?? 0),
      ),
    ),
    supabase.from("designers").select("id, display_name, active").order("display_name"),
  ]);
  const tabs = PENDING_TABS.map((t, i) => ({ ...t, count: counts[i] }));
  const totalPending = counts.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Pendings</h1>
        <p className="text-muted-foreground">{totalPending} total pending</p>
      </div>
      <RememberList label="Pendings" />
      <PendingTabs tabs={tabs} current={current} />
      {/* Designer filter on every tab (owner, Oct 22). */}
      <DataTableToolbar
        showDates={false}
        filters={[{ key: "assignee", label: "Designer", options: designerFilterOptions(designers.data ?? [], facets.assignee) }]}
      />
      <PipelineTable
        rows={rows}
        total={total}
        page={params.page}
        pageSize={params.pageSize}
        designers={(designers.data ?? []).map((d) => ({ id: d.id, name: d.display_name, active: d.active }))}
        viewer={{ designerId: user.designerId, isManager: user.isManager }}
      />
    </div>
  );
}
