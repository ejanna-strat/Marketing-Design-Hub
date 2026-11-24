"use client";

import { differenceInCalendarDays } from "date-fns";
import { PauseIcon, PlayIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { keepOnHold, resumeRequest } from "@/app/admin/actions";
import { CancelDialog } from "@/components/requests/editors";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { statusLabel } from "@/lib/statuses";

// On a request that's On hold (owner, Nov 24): how long it has been paused,
// and the three choices the 30-day reminder email points to. Keep on hold
// (next reminder in 30 days), Resume (back to the status before On hold) or
// Cancel (with a note). People who can't change the status see the facts only.
export function OnHoldBar({
  requestId,
  since,
  from,
  canAct,
}: {
  requestId: string;
  since: string | null;
  from: string | null;
  canAct: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cancelling, setCancelling] = useState(false);
  const days = since ? differenceInCalendarDays(new Date(), new Date(since)) : null;

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(done);
      router.refresh();
    });
  }

  return (
    <div
      role="region"
      aria-label="On hold"
      className="flex basis-full flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-orange-300 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/40"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
          <PauseIcon className="size-5" aria-hidden />
        </span>
        <div>
          <p className="font-semibold">
            On hold
            {days !== null && ` for ${days} ${days === 1 ? "day" : "days"}`}
            {since && <span className="font-normal text-muted-foreground"> · since {formatDate(since)}</span>}
          </p>
          <p className="text-sm text-muted-foreground">
            {canAct
              ? "Keep it on hold, resume it, or cancel it if it's no longer needed. A reminder goes out every 30 days while it stays on hold."
              : "A reminder goes to its designers and the Lead Designers every 30 days while it stays on hold."}
            {from && ` Before On hold: ${statusLabel(from)}.`}
          </p>
        </div>
      </div>
      {canAct && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => run(() => keepOnHold(requestId), "Kept on hold. Next reminder in 30 days.")}
          >
            <PauseIcon />
            Keep on hold
          </Button>
          <Button
            disabled={pending || !from}
            title={from ? undefined : "Pick the status in the Status menu"}
            onClick={() => run(() => resumeRequest(requestId), `Resumed: ${from ? statusLabel(from) : ""}`)}
          >
            <PlayIcon />
            Resume{from ? ` (${statusLabel(from)})` : ""}
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => setCancelling(true)}
            className="text-destructive hover:text-destructive"
          >
            <XIcon />
            Cancel request
          </Button>
          <CancelDialog
            requestId={requestId}
            open={cancelling}
            onClose={() => setCancelling(false)}
            onCancelled={() => setCancelling(false)}
          />
        </div>
      )}
    </div>
  );
}
