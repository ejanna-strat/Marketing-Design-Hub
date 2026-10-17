import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { FEEDBACK_COPY as C, one } from "@/lib/feedback";
import { createClient } from "@/lib/supabase/server";
import { RequestIdBox } from "./RequestIdBox";

export const metadata = { title: "Share Feedback" };

// Pick the request to rate: type its Request ID, or click one of your
// Completed requests that's still waiting for feedback (owner, Oct 18).
export default async function FeedbackPickerPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("requests")
    .select("request_code, title, date_completed, request_type:request_types(name), feedback(id)")
    .eq("requester_id", user.id)
    .eq("status", "completed")
    .order("date_completed", { ascending: false });
  const waiting = (data ?? []).filter((r) => !one(r.feedback));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{C.title}</h1>
        <p className="text-muted-foreground">{C.intro}</p>
      </div>

      <div className="space-y-3 rounded-xl border bg-background p-5">
        <h2 className="font-semibold">Type the Request ID</h2>
        <RequestIdBox />
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">Or choose a completed request</h2>
        {waiting.length === 0 ? (
          <p className="rounded-xl border bg-background p-5 text-sm text-muted-foreground">
            You have no completed requests waiting for feedback.
          </p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-background">
            {waiting.map((r) => (
              <li key={r.request_code}>
                <Link
                  href={`/feedback/${r.request_code}`}
                  className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-brand-soft/50"
                >
                  <span className="font-mono text-sm font-medium text-brand">{r.request_code}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {r.request_type?.name} · Completed {formatDate(r.date_completed)}
                    </span>
                  </span>
                  <ChevronRightIcon className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
