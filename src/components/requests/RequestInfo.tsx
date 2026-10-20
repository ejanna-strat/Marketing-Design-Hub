import { CopyButton } from "@/components/CopyButton";
import { LinkifiedText } from "@/components/LinkifiedText";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { answerText, type RequestDetail } from "@/lib/requests/detail";

// General Information and Request Specifications of one request (read-only),
// in two compact columns. Used by the requester and staff request pages.
// generalActions / specsActions: e.g. the staff "Edit" buttons.
// copyApprover: copy buttons next to the requester's and approver's emails (staff).
export function RequestInfo({
  request,
  generalActions,
  specsActions,
  copyApprover = false,
}: {
  request: RequestDetail;
  generalActions?: React.ReactNode;
  specsActions?: React.ReactNode;
  copyApprover?: boolean;
}) {
  const approverIsRequester = request.final_approver_email.toLowerCase() === request.requester_email.toLowerCase();
  const approver = approverIsRequester ? (
    `${request.final_approver_name} (same as the requester)`
  ) : (
    <span className="inline-flex flex-wrap items-center gap-1">
      {request.final_approver_name} · {request.final_approver_email}
      {copyApprover && <CopyButton value={request.final_approver_email} label="Copy approver's email" />}
    </span>
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>General Information</CardTitle>
          {generalActions && <CardAction>{generalActions}</CardAction>}
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Item label="Request ID" value={<span className="font-mono">{request.request_code}</span>} />
            <Item label="Request Date" value={<span title={formatDateTime(request.created_at)}>{formatDate(request.created_at)}</span>} />
            <Item label="Name" value={request.requester_name} />
            <Item
              label="Email"
              value={
                <span className="inline-flex flex-wrap items-center gap-1">
                  {request.requester_email}
                  {copyApprover && <CopyButton value={request.requester_email} label="Copy requester's email" />}
                </span>
              }
            />
            <Item label="Business Unit" value={request.team?.name} wide />
            <Item label="Request Title" value={request.title} wide />
            <Item label="Date Needed" value={formatDate(request.date_needed)} />
            <Item label="Final Approver of the Design" value={approver} wide />
            <Item
              label="Associated with a deal"
              wide
              value={request.is_deal ? `Yes · ${request.deal_name} · ${formatPeso(request.deal_size)}` : "No"}
            />
            <Item label="Type of Design Request" value={request.request_type?.name} />
            <Item label="Output Needed" value={request.output_needed} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Request Specifications</CardTitle>
          <CardDescription>{request.request_type?.name}</CardDescription>
          {specsActions && <CardAction>{specsActions}</CardAction>}
        </CardHeader>
        <CardContent>
          {request.answers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No specifications were given.</p>
          ) : (
            <dl className="space-y-4">
              {request.answers.map((a) => (
                <Item key={a.id} label={a.question_label_snapshot} value={<LinkifiedText text={answerText(a.value)} />} wide />
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export function Item({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 text-sm">{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}
