import { DataTableToolbar } from "@/components/data-table/DataTableToolbar";
import { RememberList } from "@/components/data-table/ListMemory";
import { requireStaff } from "@/lib/auth";
import { listRequests, parseListParams } from "@/lib/requests/list";
import { INACTIVE_STATUSES, statusOptions } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";
import { PipelineTable } from "../pipeline/PipelineTable";

// Cancelled and Returned requests, kept out of the pipeline (owner, Oct 20).
export default async function InactiveRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStaff();
  const params = parseListParams(await searchParams);
  const supabase = await createClient();

  const [{ rows, total }, designers] = await Promise.all([
    listRequests(supabase, params, { searchRequester: true, scope: "inactive" }),
    supabase.from("designers").select("id, display_name, active").order("display_name"),
  ]);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Inactive Requests</h1>
        <p className="text-muted-foreground">Cancelled and returned requests ({total}).</p>
      </div>
      <RememberList label="Inactive Requests" />
      <DataTableToolbar
        searchPlaceholder="Search ID, title, requester, type, output or designer"
        filters={[
          {
            key: "status",
            label: "Status",
            options: statusOptions().filter((o) => (INACTIVE_STATUSES as readonly string[]).includes(o.value)),
          },
        ]}
      />
      <PipelineTable
        rows={rows}
        total={total}
        page={params.page}
        pageSize={params.pageSize}
        designers={(designers.data ?? []).map((d) => ({ id: d.id, name: d.display_name, active: d.active }))}
        canAssign={user.isManager}
        extra="inactive"
      />
    </div>
  );
}
