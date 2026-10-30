import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { StarsDisplay } from "@/components/feedback/Stars";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { FEEDBACK_COPY as C, one, overallRating } from "@/lib/feedback";
import { createClient } from "@/lib/supabase/server";
import { FeedbackForm } from "./FeedbackForm";

// The §9 feedback form for one of the requester's own requests. Reached from
// the home page, the request page, or the N8 "Share Feedback" email button.
export default async function FeedbackFormPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const { data: request } = await supabase
    .from("requests")
    .select("request_code, title, status, date_completed, request_type:request_types(name), feedback(process_rating, output_rating, comments, submitted_at)")
    .eq("request_code", code.toUpperCase())
    .eq("requester_id", user.id)
    .maybeSingle();
  const feedback = one(request?.feedback);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/feedback" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        Share Feedback
      </Link>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{C.title}</h1>
        <p className="text-muted-foreground">{C.intro}</p>
      </div>

      {!request ? (
        <Message>
          We couldn&apos;t find <span className="font-mono">{code.toUpperCase()}</span> among your requests. Please check the
          Request ID.
        </Message>
      ) : (
        <>
          <Card>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <Field label="Request ID" value={<span className="font-mono">{request.request_code}</span>} />
              <Field label="Request Title" value={request.title} />
              <Field label="Type" value={request.request_type?.name} />
            </CardContent>
          </Card>
          {feedback ? (
            <Message>
              <p className="font-medium">You already shared feedback for this request. Thank you!</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <Field label="Process" value={<StarsDisplay value={feedback.process_rating} />} />
                <Field label="Output" value={<StarsDisplay value={feedback.output_rating} />} />
                <Field label="Overall" value={<StarsDisplay value={overallRating(feedback)} />} />
              </div>
            </Message>
          ) : request.status !== "completed" ? (
            <Message>
              You can share feedback once this request is <span className="font-medium">Completed</span>.
            </Message>
          ) : (
            <>
              {request.date_completed && (
                <p className="text-sm text-muted-foreground">Completed on {formatDate(request.date_completed)}.</p>
              )}
              <FeedbackForm code={request.request_code} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border bg-background p-5 text-sm">
      <div>{children}</div>
      <Button asChild variant="outline" size="sm">
        <Link href="/feedback">Choose another request</Link>
      </Button>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="mt-1 text-sm">{value || "—"}</div>
    </div>
  );
}
