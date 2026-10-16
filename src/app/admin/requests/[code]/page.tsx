import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DateNeededEditor, DesignerSelect, LinkEditor, StatusSelect } from "@/components/requests/editors";
import { Item, RequestInfo } from "@/components/requests/RequestInfo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getRequestByCode } from "@/lib/requests/detail";
import { statusLabel } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  return { title: (await params).code };
}

// Request Details window for the Marketing team. Admins and Lead Designers
// can edit Date Needed, Status, Designer and Link; Designers Status and Link.
export default async function AdminRequestDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireStaff();
  const supabase = await createClient();
  const request = await getRequestByCode(supabase, code);
  if (!request) notFound();

  const [{ data: designers }, { data: log }] = await Promise.all([
    supabase.from("designers").select("id, display_name, active").order("display_name"),
    supabase
      .from("activity_log")
      .select("id, action, from_value, to_value, note, created_at, actor:profiles(full_name)")
      .eq("request_id", request.id)
      .order("created_at", { ascending: false }),
  ]);
  const designerOptions = (designers ?? []).map((d) => ({ id: d.id, name: d.display_name, active: d.active }));

  return (
    <div className="space-y-6">
      <Link href="/admin/pipeline" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        Marketing Design Pipeline
      </Link>
      <div className="space-y-1">
        <p className="font-mono text-sm text-muted-foreground">{request.request_code}</p>
        <h1 className="text-2xl font-bold">{request.title}</h1>
        <p className="text-sm text-muted-foreground">
          {request.request_type?.name} · Requested by {request.requester_name} ({request.team?.name})
        </p>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                <Item label="Status" value={<StatusSelect requestId={request.id} value={request.status} />} />
                <Item
                  label="Assigned Designer"
                  value={
                    user.isManager ? (
                      <DesignerSelect requestId={request.id} value={request.assigned_designer_id} designers={designerOptions} />
                    ) : (
                      request.designer?.display_name
                    )
                  }
                />
                <Item label="Link to Output" value={<LinkEditor requestId={request.id} value={request.link_to_output} />} />
                <Item
                  label="Date Needed"
                  value={
                    user.isManager ? (
                      <DateNeededEditor requestId={request.id} value={request.date_needed} />
                    ) : (
                      formatDate(request.date_needed)
                    )
                  }
                />
                <Item label="Date Started" value={formatDate(request.date_started)} />
                <Item label="Date Completed" value={formatDate(request.date_completed)} />
              </dl>
            </CardContent>
          </Card>
          <RequestInfo request={request} />
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
  status: "Status",
  designer: "Assigned Designer",
  link_to_output: "Link to Output",
  date_needed: "Date Needed",
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
            {e.action === "created" ? (
              "submitted the request"
            ) : (
              <>
                changed <span className="font-medium">{FIELD_NAMES[e.action] ?? e.action}</span>
              </>
            )}
          </p>
          {e.action !== "created" && (
            <p className="mt-1 break-words text-muted-foreground">
              <span className="line-through decoration-muted-foreground/50">{showValue(e.action, e.from_value)}</span>
              {" → "}
              <span className="text-foreground">{showValue(e.action, e.to_value)}</span>
            </p>
          )}
          {e.note && <p className="mt-1 text-muted-foreground">{e.note}</p>}
          <time className="mt-1 block text-xs text-muted-foreground" dateTime={e.created_at}>
            {formatDateTime(e.created_at)}
          </time>
        </li>
      ))}
    </ol>
  );
}
