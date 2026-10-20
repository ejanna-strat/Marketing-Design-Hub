import Link from "next/link";
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
  // Everyone opens on All + Open, so new requests are seen at once (owner,
  // Oct 21; replaces "designers open on their own tab").
  const supabase = await createClient();

  const options = { searchRequester: true, scope: "pipeline" } as const;
  const [{ rows, total }, present, designers, teams, types, open] = await Promise.all([
    listRequests(supabase, params, options),
    statusesInView(supabase, params, options),
    supabase.from("designers").select("id, display_name, active").order("display_name"),
    supabase.from("teams").select("id, name").order("sort_order"),
    supabase.from("request_types").select("id, name").order("sort_order"),
    // Open work (not Completed, On hold, Cancelled or Returned) for the tab counts.
    supabase.from("requests").select("assigned_designer_id").not("status", "in", "(completed,on_hold,cancelled,rejected)"),
  ]);
  const openRows = open.data ?? [];
  const counts: Record<string, number> = { all: openRows.length };
  for (const r of openRows) {
    const key = r.assigned_designer_id ?? "none";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const designerOptions = (designers.data ?? []).map((d) => ({ id: d.id, name: d.display_name, active: d.active }));
  // Tabs: active designers, plus a former designer if their tab is open.
  const tabDesigners = designerOptions.filter((d) => d.active || d.id === params.designer);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Marketing Design Pipeline</h1>
        <p className="text-muted-foreground">
          <span className="font-semibold text-foreground">{counts.all} open requests</span>
          {counts.none ? ` · ${counts.none} unassigned` : ""} · Cancelled and returned requests are on{" "}
          <Link href="/admin/inactive" className="text-brand hover:underline">
            Inactive Requests
          </Link>
          .
        </p>
      </div>
      <RememberList label="Marketing Design Pipeline" />
      <DesignerTabs designers={tabDesigners} current={params.designer} myDesignerId={user.designerId} counts={counts} />
      <DataTableToolbar
        leading={<ViewSwitch />}
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
