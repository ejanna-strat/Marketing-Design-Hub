import { CopyButton } from "@/components/CopyButton";
import { LinkifiedText } from "@/components/LinkifiedText";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/dates";
import { answerText, type RequestDetail } from "@/lib/requests/detail";
import { cn } from "@/lib/utils";

// General Information and Request Specifications of one request (read-only).
// layout "grid": two columns (staff page). layout "form": one column laid
//   out like the New Design Request form (requester page, owner Oct 18).
// generalActions / specsActions: e.g. the staff "Edit" buttons.
// copyApprover: show a copy button next to the approver's email (staff).
export function RequestInfo({
  request,
  layout = "grid",
  generalActions,
  specsActions,
  copyApprover = false,
}: {
  request: RequestDetail;
  layout?: "grid" | "form";
  generalActions?: React.ReactNode;
  specsActions?: React.ReactNode;
  copyApprover?: boolean;
}) {
  const approverIsRequester = request.final_approver_email.toLowerCase() === request.requester_email.toLowerCase();
  const I = layout === "form" ? FieldItem : Item;
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
          <dl className={layout === "form" ? "space-y-5" : "grid gap-x-6 gap-y-4 sm:grid-cols-2"}>
            {layout === "grid" && <I label="Request ID" value={<span className="font-mono">{request.request_code}</span>} />}
            {layout === "grid" && (
              <I label="Request Date" value={<span title={formatDateTime(request.created_at)}>{formatDate(request.created_at)}</span>} />
            )}
            <I label="Name" value={request.requester_name} />
            <I label="Email" value={request.requester_email} />
            <I label="Business Unit" value={request.team?.name} wide />
            <I label="Request Title" value={request.title} wide />
            <I label="Date Needed" value={formatDate(request.date_needed)} />
            <I label="Final Approver of the Design" value={approver} wide />
            <I label="Type of Design Request" value={request.request_type?.name} />
            <I label="Output Needed" value={request.output_needed} />
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
            <dl className={layout === "form" ? "space-y-5" : "space-y-4"}>
              {request.answers.map((a) => (
                <I key={a.id} label={a.question_label_snapshot} value={<LinkifiedText text={answerText(a.value)} />} wide />
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

// Read-only "filled-in field": label above, answer in a soft box, like the form.
export function FieldItem({ label, value }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className="space-y-1.5">
      <dt className="text-sm font-medium">{label}</dt>
      <dd className={cn("rounded-lg border bg-muted/40 px-3 py-2 text-sm", !value && "text-muted-foreground")}>
        {value || "—"}
      </dd>
    </div>
  );
}
