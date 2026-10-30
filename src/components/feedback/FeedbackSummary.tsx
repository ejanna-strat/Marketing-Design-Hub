import { StarsDisplay } from "@/components/feedback/Stars";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// The feedback report card: overall stars, Process and Output averages, and
// how many completed requests have feedback (Marketing team requesters
// excluded). Used on the Dashboard and Analytics (owner, Oct 23).
export function FeedbackSummary({
  title = "Overall feedback",
  overall,
  process,
  output,
  responses,
  completed,
  children,
}: {
  title?: string;
  overall: number | null;
  process: number | null;
  output: number | null;
  responses: number;
  completed: number;
  children?: React.ReactNode;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{overall === null ? "—" : <StarsDisplay value={overall} size="md" />}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Process average</dt>
            <dd>{process === null ? "—" : <StarsDisplay value={process} />}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Output average</dt>
            <dd>{output === null ? "—" : <StarsDisplay value={output} />}</dd>
          </div>
        </dl>
        <p className="text-sm">
          <span className="font-semibold">{responses}</span> of {completed} completed requests have feedback
          {completed > 0 && <span className="text-muted-foreground"> · {Math.round((responses / completed) * 100)}%</span>}
        </p>
        <p className="text-xs text-muted-foreground">Marketing team requesters excluded</p>
        {children}
      </CardContent>
    </Card>
  );
}
