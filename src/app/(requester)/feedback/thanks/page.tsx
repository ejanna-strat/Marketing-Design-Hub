import { HeartHandshakeIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FEEDBACK_COPY as C } from "@/lib/feedback";

export const metadata = { title: "Thank you" };

export default async function FeedbackThanksPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return (
    <div className="mx-auto max-w-xl space-y-6 rounded-xl border bg-background p-8 text-center">
      <HeartHandshakeIcon className="mx-auto size-14 text-brand" />
      <p className="leading-relaxed">{C.thanks}</p>
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/feedback">Submit Another Feedback</Link>
        </Button>
        {code && (
          <Button asChild size="lg" variant="outline">
            <Link href={`/my-requests/${code}`}>Back to my request</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
