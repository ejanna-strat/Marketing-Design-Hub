"use client";

import { XCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cancelMyRequest } from "./actions";

// Lets the requester cancel their own request, with a reason (owner, Oct 21).
export function CancelRequestButton({ requestId, hasDesigner }: { requestId: string; hasDesigner: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <XCircleIcon />
        Cancel request
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this request?</DialogTitle>
            <DialogDescription>
              {hasDesigner
                ? "The designer working on it will get an email with your reason. This can't be undone from your side."
                : "The Design team will see it as Cancelled. This can't be undone from your side."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">
              Reason for cancelling <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="cancel-reason"
              rows={4}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. The event was moved, so this material is no longer needed."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Keep request
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await cancelMyRequest(requestId, reason);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Request cancelled");
                  setOpen(false);
                  router.refresh();
                })
              }
            >
              Cancel request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
