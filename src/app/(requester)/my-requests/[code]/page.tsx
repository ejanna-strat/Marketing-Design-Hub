import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OutputLink } from "@/components/LinkifiedText";
import { Item, RequestInfo } from "@/components/requests/RequestInfo";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { getRequestByCode } from "@/lib/requests/detail";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  return { title: (await params).code };
}

// Read-only details of one of the signed-in person's own requests.
export default async function MyRequestDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const request = await getRequestByCode(supabase, code, { requesterId: user.id });
  if (!request) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/my-requests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        My Design Requests
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-sm text-muted-foreground">{request.request_code}</p>
          <h1 className="text-2xl font-bold">{request.title}</h1>
        </div>
        <StatusBadge status={request.status} audience="requester" className="px-3 py-1 text-sm" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <Item label="Status" value={<StatusBadge status={request.status} audience="requester" />} />
            <Item label="Assigned Designer" value={request.designer?.display_name} />
            <Item label="Link to Output" value={request.link_to_output && <OutputLink value={request.link_to_output} />} />
            <Item label="Date Completed" value={request.date_completed && formatDate(request.date_completed)} />
          </dl>
        </CardContent>
      </Card>

      <RequestInfo request={request} />
    </div>
  );
}
