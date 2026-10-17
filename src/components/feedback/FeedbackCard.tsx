import { MessageSquareHeartIcon } from "lucide-react";
import Link from "next/link";
import { LinkifiedText } from "@/components/LinkifiedText";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { overallRating } from "@/lib/feedback";
import { StarsDisplay } from "./Stars";

type Feedback = { process_rating: number; output_rating: number; comments: string | null; submitted_at: string } | null;

// The Feedback section of a request page. Requesters get the Share Feedback
// button (greyed out until Completed); staff see what was shared.
export function FeedbackCard({
  feedback,
  status,
  code,
  audience,
}: {
  feedback: Feedback;
  status: string;
  code: string;
  audience: "requester" | "staff";
}) {
  const completed = status === "completed";
  return (
    <Card>
      <CardHeader>
        <CardTitle>Feedback</CardTitle>
        {feedback && <CardDescription>Shared {formatDate(feedback.submitted_at)}</CardDescription>}
      </CardHeader>
      <CardContent>
        {feedback ? (
          <div className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-3">
              <Rating label="Process" value={feedback.process_rating} />
              <Rating label="Output" value={feedback.output_rating} />
              <Rating label="Overall" value={overallRating(feedback)} />
            </dl>
            {feedback.comments && (
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Comments</p>
                <LinkifiedText text={feedback.comments} className="mt-1 block text-sm" />
              </div>
            )}
          </div>
        ) : audience === "staff" ? (
          <p className="text-sm text-muted-foreground">
            {completed ? "No feedback from the requester yet." : "The requester can share feedback once this is Completed."}
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {completed
                ? "How did we do? Rate the process and the output in under a minute."
                : "You can share feedback once this request is Completed."}
            </p>
            {completed ? (
              <Button asChild>
                <Link href={`/feedback/${code}`}>
                  <MessageSquareHeartIcon />
                  Share feedback
                </Link>
              </Button>
            ) : (
              <Button disabled aria-disabled title="Available once the request is Completed">
                <MessageSquareHeartIcon />
                Share feedback
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Rating({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 text-sm">
        <StarsDisplay value={value} />
      </dd>
    </div>
  );
}
