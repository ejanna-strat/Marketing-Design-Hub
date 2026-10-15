import { CheckCircle2Icon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Request Submitted" };

export default async function SubmittedPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;

  return (
    <div className="mx-auto max-w-xl space-y-6 rounded-xl border bg-background p-8 text-center">
      <CheckCircle2Icon className="mx-auto size-14 text-brand" />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Request Submitted!</h1>
        {code && (
          <p className="text-muted-foreground">
            Your Request ID is <span className="font-mono font-semibold text-foreground">{code}</span>
          </p>
        )}
      </div>
      <div className="space-y-3 text-left text-sm leading-relaxed">
        <p>
          Please note that submitting a request does not mean it has been accepted or started. All requests are subject
          to review and approval by the Design Team.
        </p>
        <p>You will receive a separate notification once the assigned designer started working on your request.</p>
        <p>You can track the status of your request anytime through Track My Requests.</p>
      </div>
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/my-requests">Track My Request</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/requests/new">Submit Another Request</Link>
        </Button>
      </div>
    </div>
  );
}
