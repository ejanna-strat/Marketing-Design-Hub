import { ArrowLeftIcon, CheckCircle2Icon, FilePlus2Icon, PencilIcon, UndoIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { FeedbackCard } from "@/components/feedback/FeedbackCard";
import { OutputLink } from "@/components/LinkifiedText";
import { Item, RequestInfo } from "@/components/requests/RequestInfo";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { one } from "@/lib/feedback";
import { canRequesterEdit, getRequestByCode } from "@/lib/requests/detail";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// One of the signed-in person's own requests, in the same compact two-column
// layout as the staff page (owner, Oct 18). They can edit it until accepted.
export default async function MyRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { code } = await params;
  const { saved } = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const request = await getRequestByCode(supabase, code, { requesterId: user.id });
  if (!request) notFound();
  const editable = canRequesterEdit(request);
  // Requesters can't read staff profiles, so the reviewer's name and email
  // are looked up on the server.
  const returnedBy =
    request.status === "rejected" && request.returned_by
      ? (await createAdminClient().from("profiles").select("full_name, email").eq("id", request.returned_by).maybeSingle())
          .data
      : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/my-requests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        My Design Requests
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-sm text-muted-foreground">{request.request_code}</p>
          <h1 className="text-2xl font-bold">{request.title}</h1>
          <p className="text-sm text-muted-foreground">Requested {formatDate(request.created_at)}</p>
        </div>
        {editable && (
          <Button asChild>
            <Link href={`/my-requests/${request.request_code}/edit`}>
              <PencilIcon />
              Edit request
            </Link>
          </Button>
        )}
      </div>

      {saved && (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <CheckCircle2Icon className="size-4 shrink-0" />
          Your changes were saved.
        </p>
      )}
      {request.status === "rejected" && (
        <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-950">
          <p className="flex items-center gap-2 text-base font-semibold">
            <UndoIcon className="size-5" />
            Your request was returned
          </p>
          <p>
            <span className="font-medium">Reason for Return:</span> {request.return_reason ?? "—"}
          </p>
          <p>
            For any questions or clarifications, you may coordinate with{" "}
            <span className="font-bold">{returnedBy?.full_name ?? "the Design team"}</span>
            {returnedBy?.email && (
              <span className="inline-flex items-center gap-1">
                {" "}
                ({returnedBy.email}
                <CopyButton value={returnedBy.email} label="Copy email" />)
              </span>
            )}{" "}
            that returned the request.
          </p>
          <Button asChild>
            <Link href="/requests/new">
              <FilePlus2Icon />
              Submit a New Design Request
            </Link>
          </Button>
        </div>
      )}
      {request.status === "rejected" ? null : editable ? (
        <p className="text-sm text-muted-foreground">You can edit this request until it is accepted by the reviewer.</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          This request has been accepted, so it can no longer be edited. For changes, please contact the Design team.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Item label="Status" value={<StatusBadge status={request.status} audience="requester" />} />
            <Item
              label="Assigned Designer"
              value={
                request.designer && (
                  <span className="inline-flex flex-wrap items-center gap-1">
                    {request.designer.display_name} · {request.designer.email}
                    <CopyButton value={request.designer.email} label="Copy designer's email" />
                  </span>
                )
              }
            />
            <Item label="Link to Output" value={request.link_to_output && <OutputLink value={request.link_to_output} />} />
            <Item label="Date Completed" value={request.date_completed && formatDate(request.date_completed)} />
          </dl>
        </CardContent>
      </Card>

      <FeedbackCard feedback={one(request.feedback)} status={request.status} code={request.request_code} audience="requester" />

      <RequestInfo request={request} />
    </div>
  );
}
