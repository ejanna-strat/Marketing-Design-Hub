import { PencilIcon } from "lucide-react";
import { BackToList } from "@/components/data-table/ListMemory";
import { FeedbackCard } from "@/components/feedback/FeedbackCard";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DateNeededEditor,
  DesignerSelect,
  GeneralInfoEditor,
  LinkEditor,
  StatusSelect,
} from "@/components/requests/editors";
import { Item, RequestInfo } from "@/components/requests/RequestInfo";
import { WorkflowPanel } from "@/components/requests/WorkflowPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/dates";
import { one } from "@/lib/feedback";
import { getRequestByCode } from "@/lib/requests/detail";
import { designerChoice, statusLabel } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

// Request Details window for the Marketing team. Everyone on the team can edit
// Status, Link, Date Needed and General Information; Super Admins and Lead
// Designers also review new requests and assign or remove the designer.
export default async function AdminRequestDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireStaff();
  const supabase = await createClient();
  // All three load at once: the activity log is matched by request code, so
  // it doesn't have to wait for the request itself.
  const [request, { data: designers }, { data: log }, { data: teams }] = await Promise.all([
    getRequestByCode(supabase, code),
    supabase.from("designers").select("id, display_name, active").order("display_name"),
    supabase
      .from("activity_log")
      .select("id, action, from_value, to_value, note, created_at, actor:profiles(full_name), request:requests!inner(request_code)")
      .eq("request.request_code", code.toUpperCase())
      .order("created_at", { ascending: false }),
    supabase.from("teams").select("id, name").eq("active", true).order("sort_order"),
  ]);
  if (!request) notFound();
  const { data: returnedBy } = request.returned_by
    ? await supabase.from("profiles").select("full_name").eq("id", request.returned_by).maybeSingle()
    : { data: null };
  const designerOptions = (designers ?? []).map((d) => ({ id: d.id, name: d.display_name, active: d.active }));

  const closed = request.status === "cancelled" || request.status === "rejected";
  const viewer = { designerId: user.designerId, isManager: user.isManager, isAdmin: user.isAdmin };

  return (
    <div className="space-y-6">
      <BackToList fallbackHref="/admin/pipeline" fallbackLabel="Marketing Design Pipeline" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-sm text-muted-foreground">{request.request_code}</p>
          <h1 className="text-2xl font-bold">{request.title}</h1>
          <p className="text-sm text-muted-foreground">
            {request.request_type?.name} · Requested by {request.requester_name} ({request.team?.name})
          </p>
        </div>
        <WorkflowPanel
          isManager={user.isManager}
          myDesignerId={user.designerId}
          isAssignedDesigner={!!user.designerId && user.designerId === request.assigned_designer_id}
          designers={designerOptions.filter((d) => d.active).map((d) => ({ id: d.id, name: d.name }))}
          state={{
            requestId: request.id,
            status: request.status,
            designer: request.assigned_designer_id
              ? { id: request.assigned_designer_id, name: request.designer?.display_name ?? "the designer" }
              : null,
            designerResponse: request.designer_response,
            respondedAt: request.designer_responded_at,
            returnReason: request.return_reason,
            returnedByName: returnedBy?.full_name ?? null,
            reassignReason: request.reassign_reason,
            cancelReason: request.cancel_reason,
          }}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                <Item label="Status" value={<StatusSelect
                      requestId={request.id}
                      value={request.status}
                      hasDesigner={!!request.assigned_designer_id}
                      hasLink={!!request.link_to_output}
                      accepted={!!request.assigned_designer_id && request.designer_response === "accepted"}
                    />} />
                <Item
                  label="Assigned Designer"
                  value={
                    user.isManager || user.isAdmin || user.designerId ? (
                      <DesignerSelect
                        requestId={request.id}
                        value={request.assigned_designer_id}
                        designers={designerOptions}
                        selfId={user.designerId}
                        {...designerChoice(request.status, request.assigned_designer_id, viewer)}
                      />
                    ) : (
                      request.designer?.display_name
                    )
                  }
                />
                <Item label="Link to Output" value={<LinkEditor
                      requestId={request.id}
                      value={request.link_to_output}
                      locked={request.status === "cancelled" || request.status === "rejected"}
                    />} />
                <Item
                  label="Date Needed"
                  value={closed ? formatDate(request.date_needed) : <DateNeededEditor requestId={request.id} value={request.date_needed} />}
                />
                <Item label="Date Started" value={formatDate(request.date_started)} />
                <Item label="Date Completed" value={formatDate(request.date_completed)} />
              </dl>
            </CardContent>
          </Card>
          <FeedbackCard feedback={one(request.feedback)} status={request.status} code={request.request_code} audience="staff" />
          <RequestInfo
            request={request}
            copyApprover
            // Cancelled and Returned requests are read-only except the status (owner, Oct 21).
            specsActions={
              closed ? undefined : (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/requests/${request.request_code}/specifications`}>
                    <PencilIcon />
                    Edit specifications
                  </Link>
                </Button>
              )
            }
            generalActions={
              closed ? undefined : (
                <GeneralInfoEditor
                  requestId={request.id}
                  teams={teams ?? []}
                  value={{
                    title: request.title,
                    projectOverview: request.project_overview ?? "",
                    requesterName: request.requester_name,
                    teamId: request.team_id,
                    approverName: request.final_approver_name,
                    approverEmail: request.final_approver_email,
                    isDeal: request.is_deal,
                    dealName: request.deal_name ?? "",
                    dealSize: request.deal_size === null ? "" : String(request.deal_size),
                  }}
                />
              )
            }
          />
        </div>

        <Card className="xl:sticky xl:top-20">
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityLog entries={log ?? []} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type LogEntry = Pick<Tables<"activity_log">, "id" | "action" | "from_value" | "to_value" | "note" | "created_at"> & {
  actor: { full_name: string } | null;
};

const FIELD_NAMES: Record<string, string> = {
  title: "Request Title",
  requester_name: "Requester's Name",
  team: "Business Unit",
  final_approver: "Final Approver",
  status: "Status",
  designer: "Assigned Designer",
  link_to_output: "Link to Output",
  date_needed: "Date Needed",
  output_needed: "Output Needed",
};

// Log entries that are a sentence on their own (no old → new values).
const SENTENCES: Record<string, string> = {
  created: "submitted the request",
  edited: "edited the request details",
  specs: "edited the request specifications",
  designer_accepted: "accepted the request",
  reassign_requested: "asked to reassign the request",
  returned: "returned the request",
  cancelled: "cancelled the request",
  project_overview: "changed Project Overview and Objective",
};

function showValue(action: string, value: string | null) {
  if (!value) return "—";
  if (action === "status") return statusLabel(value);
  if (action === "date_needed") return formatDate(value);
  return value;
}

function ActivityLog({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ol className="relative space-y-5 border-l pl-5">
      {entries.map((e) => (
        <li key={e.id} className="relative text-sm">
          <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-brand" />
          <p>
            <span className="font-medium">{e.actor?.full_name ?? "System"}</span>{" "}
            {SENTENCES[e.action] ? (
              SENTENCES[e.action]
            ) : e.action === "feedback" ? (
              <>
                shared feedback: <span className="font-medium">{Number(e.to_value).toFixed(1)} ⭐</span>
              </>
            ) : (
              <>
                changed <span className="font-medium">{FIELD_NAMES[e.action] ?? e.action}</span>
              </>
            )}
          </p>
          {!SENTENCES[e.action] && e.action !== "feedback" && (
            <p className="mt-1 break-words text-muted-foreground">
              <span className="line-through decoration-muted-foreground/50">{showValue(e.action, e.from_value)}</span>
              {" → "}
              <span className="text-foreground">{showValue(e.action, e.to_value)}</span>
            </p>
          )}
          {e.note && (!SENTENCES[e.action] || e.action === "returned" || e.action === "reassign_requested") && <p className="mt-1 text-muted-foreground">{e.note}</p>}
          <time className="mt-1 block text-xs text-muted-foreground" dateTime={e.created_at}>
            {formatDateTime(e.created_at)}
          </time>
        </li>
      ))}
    </ol>
  );
}
