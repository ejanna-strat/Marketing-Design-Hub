import { DataTableToolbar } from "@/components/data-table/DataTableToolbar";
import { requireStaff } from "@/lib/auth";
import { listRequests, PAGE_SIZE, parseListParams } from "@/lib/requests/list";
import { PENDING_TABS } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";
import { PipelineTable } from "../pipeline/PipelineTable";
import { PendingTabs } from "./PendingTabs";

export const metadata = { title: "Pendings" };

// §7.2 #5: every open request, one tab per pending status. Status, Designer
// and Link to Output can be edited right here (same table as the pipeline).
export default async function PendingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStaff();
  const params = parseListParams(await searchParams);
  if (!PENDING_TABS.some((t) => t.status === params.status)) params.status = "new_request";
  const supabase = await createClient();

  const [{ rows, total }, counts, designers] = await Promise.all([
    listRequests(supabase, params, { searchRequester: true }),
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
      <PendingTabs tabs={tabs} current={params.status} />
      <DataTableToolbar searchPlaceholder="Search ID, title, requester, type, output or designer" showDates={false} filters={[]} />
      <PipelineTable
        rows={rows}
        total={total}
        page={params.page}
        pageSize={PAGE_SIZE}
        designers={(designers.data ?? []).map((d) => ({ id: d.id, name: d.display_name, active: d.active }))}
        canAssign={user.isManager}
      />
    </div>
  );
}
