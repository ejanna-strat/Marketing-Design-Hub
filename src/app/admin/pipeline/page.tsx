import { DataTableToolbar } from "@/components/data-table/DataTableToolbar";
import { RememberList } from "@/components/data-table/ListMemory";
import { ViewSwitch } from "@/components/data-table/ViewSwitch";
import { requireStaff } from "@/lib/auth";
import { listRequests, parseListParams, statusesInView } from "@/lib/requests/list";
import { statusFilterOptions } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";
import { DesignerTabs } from "./DesignerTabs";
import { PipelineTable } from "./PipelineTable";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStaff();
  const sp = await searchParams;
  const params = parseListParams(sp);
  // Designers and Lead Designers open on their own tab; "designer=all" is
  // the All tab.
  if (sp.designer === undefined && user.designerId) params.designer = user.designerId;
  const supabase = await createClient();

  const options = { searchRequester: true, scope: "pipeline" } as const;
  const [{ rows, total }, present, designers, teams, types] = await Promise.all([
    listRequests(supabase, params, options),
    statusesInView(supabase, params, options),
    supabase.from("designers").select("id, display_name, active").order("display_name"),
    supabase.from("teams").select("id, name").order("sort_order"),
    supabase.from("request_types").select("id, name").order("sort_order"),
  ]);
  const designerOptions = (designers.data ?? []).map((d) => ({ id: d.id, name: d.display_name, active: d.active }));
  // Tabs: active designers, plus a former designer if their tab is open.
  const tabDesigners = designerOptions.filter((d) => d.active || d.id === params.designer);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Marketing Design Pipeline</h1>
        <p className="text-muted-foreground">
          Track all design requests. Cancelled and returned requests are on the Inactive Requests page.
        </p>
      </div>
      <RememberList label="Marketing Design Pipeline" />
      <DesignerTabs designers={tabDesigners} current={params.designer} myDesignerId={user.designerId} />
      <ViewSwitch />
      <DataTableToolbar
        searchPlaceholder="Search ID, title, requester, type, output or designer"
        filters={[
          {
            key: "status",
            label: "Status",
            // Cancelled and Returned live on the Inactive Requests page.
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
        designers={designerOptions}
        canAssign={user.isManager}
      />
    </div>
  );
}
