import { DataTableToolbar } from "@/components/data-table/DataTableToolbar";
import { RememberList } from "@/components/data-table/ListMemory";
import { SummaryBox, shareOf } from "@/components/SummaryBox";
import { requireStaff } from "@/lib/auth";
import { manilaDayStart, todayInManila } from "@/lib/dates";
import { designerFilterOptions, facetsInView, listRequests, markAvailable, parseListParams } from "@/lib/requests/list";
import { ACCEPTED_STATUSES } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";
import { PipelineTable } from "../pipeline/PipelineTable";

// Completed requests, on their own page instead of the pipeline's Completed
// view (owner, Oct 30). Filters: Team, Type, Request date and Designer.
export default async function CompletedRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStaff();
  const params = parseListParams(await searchParams);
  const supabase = await createClient();
  const year = todayInManila().slice(0, 4);
  const yearStart = manilaDayStart(`${year}-01-01`);

  const options = { searchRequester: true, scope: "completed" } as const;
  const [{ rows, total }, facets, designers, teams, types, ytd, acceptedLog] = await Promise.all([
    listRequests(supabase, params, options),
    facetsInView(supabase, params, options),
    supabase.from("designers").select("id, display_name, active").order("display_name"),
    supabase.from("teams").select("id, name").order("sort_order"),
    supabase.from("request_types").select("id, name").order("sort_order"),
    // The summary box matches the Dashboard's Completed tile: this year's
    // requests, as a share of those a designer accepted (ever, so ones later
    // put on hold, returned or cancelled count too).
    supabase.from("requests").select("id, status").gte("created_at", yearStart),
    supabase
      .from("activity_log")
      .select("request_id, request:requests!inner(created_at)")
      .eq("action", "status")
      .in("to_value", [...ACCEPTED_STATUSES])
      .gte("request.created_at", yearStart),
  ]);
  const yearRows = ytd.data ?? [];
  const everAccepted = new Set((acceptedLog.data ?? []).map((l) => l.request_id));
  const acceptedStatuses: readonly string[] = ACCEPTED_STATUSES;
  const accepted = yearRows.filter((r) => acceptedStatuses.includes(r.status) || everAccepted.has(r.id)).length;
  const completed = yearRows.filter((r) => r.status === "completed").length;
  const designerOptions = (designers.data ?? []).map((d) => ({ id: d.id, name: d.display_name, active: d.active }));

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Completed Requests</h1>
        <p className="text-muted-foreground">Finished design requests, turned over to the requester.</p>
      </div>
      <RememberList label="Completed Requests" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryBox
          title="Total completed"
          value={completed}
          rate={shareOf(completed, accepted)}
          lines={[`${year} year to date · % of accepted requests`]}
        />
      </div>
      <DataTableToolbar
        filters={[
          {
            key: "team",
            label: "Team",
            options: markAvailable(
              (teams.data ?? []).map((t) => ({ value: t.id, label: t.name })),
              facets.team,
            ),
          },
          {
            key: "type",
            label: "Type",
            options: markAvailable(
              (types.data ?? []).map((t) => ({ value: t.id, label: t.name })),
              facets.type,
            ),
          },
          {
            key: "assignee",
            label: "Designer",
            // Completed requests always have a designer.
            options: designerFilterOptions(designers.data ?? [], facets.assignee, { unassigned: false }),
          },
        ]}
      />
      <PipelineTable
        rows={rows}
        total={total}
        page={params.page}
        pageSize={params.pageSize}
        designers={designerOptions}
        viewer={{ designerId: user.designerId, isManager: user.isManager, isAdmin: user.isAdmin }}
      />
    </div>
  );
}
