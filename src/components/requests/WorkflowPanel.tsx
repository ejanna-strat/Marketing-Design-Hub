"use client";

import { CheckIcon, RotateCcwIcon, UndoIcon, UserCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { respondAsDesigner, returnRequest, updateRequest } from "@/app/admin/actions";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

// Phase 2 workflow (CLAUDE.md §8.1), top right of the staff Request Details:
// a tag showing where the request stands, and the buttons for whoever's turn
// it is. Reviewer (Admin / Lead Designer): Accept & assign, or Return.
// Assigned designer: Accept, or Ask to reassign.
export type WorkflowState = {
  requestId: string;
  status: string;
  designer: { id: string; name: string } | null;
  designerResponse: string | null;
  respondedAt: string | null;
  returnReason: string | null;
  returnedByName: string | null;
  reassignReason: string | null;
};

export function WorkflowPanel({
  state,
  isManager,
  isAssignedDesigner,
  designers,
}: {
  state: WorkflowState;
  isManager: boolean;
  isAssignedDesigner: boolean;
  designers: { id: string; name: string }[];
}) {
  const s = state;
  const canReview = isManager && s.status === "new_request";
  const canRespond = isAssignedDesigner && s.designerResponse === "pending";
  const showButtons = (canReview && !s.designer) || canRespond;

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Tag state={s} />
      {showButtons && (
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {canRespond && <DesignerButtons requestId={s.requestId} />}
          {canReview && !s.designer && <AssignButton requestId={s.requestId} designers={designers} />}
          {/* Return only before a designer is assigned (owner, Oct 20). */}
          {canReview && !s.designer && <ReturnButton requestId={s.requestId} />}
        </div>
      )}
    </div>
  );
}

function Tag({ state: s }: { state: WorkflowState }) {
  let tone = "bg-sky-100 text-sky-800";
  let text: React.ReactNode = "Waiting for review";
  let detail: string | null = null;
  if (s.status === "rejected") {
    tone = "bg-red-100 text-red-800";
    text = `Returned${s.returnedByName ? ` by ${s.returnedByName}` : ""}`;
    detail = s.returnReason;
  } else if (s.designer && s.designerResponse === "pending") {
    tone = "bg-amber-100 text-amber-900";
    text = `Waiting for ${s.designer.name} to accept`;
  } else if (s.designer && s.designerResponse === "accepted") {
    tone = "bg-emerald-100 text-emerald-800";
    text = `Accepted by ${s.designer.name}${s.respondedAt ? ` · ${formatDate(s.respondedAt)}` : ""}`;
  } else if (!s.designer && s.status === "new_request" && s.reassignReason) {
    tone = "bg-orange-100 text-orange-900";
    text = "Reassignment requested";
    detail = s.reassignReason;
  } else if (s.status !== "new_request") {
    return null;
  }
  return (
    <div className="max-w-sm space-y-1 sm:text-right">
      <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-medium", tone)}>{text}</span>
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function useRun() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, done?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong.");
        return;
      }
      toast.success(success);
      done?.();
      router.refresh();
    });
  return { run, pending };
}

function AssignButton({ requestId, designers }: { requestId: string; designers: { id: string; name: string }[] }) {
  const { run, pending } = useRun();
  const [open, setOpen] = useState(false);
  const [designer, setDesigner] = useState("");
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserCheckIcon />
        Accept & assign
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Accept and assign a designer</DialogTitle>
            <DialogDescription>The designer gets an email and can accept the task or ask to reassign it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="assign-designer">Designer</Label>
            <Select value={designer} onValueChange={setDesigner}>
              <SelectTrigger id="assign-designer" className="w-full">
                <SelectValue placeholder="Choose a designer" />
              </SelectTrigger>
              <SelectContent position="popper">
                {designers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!designer || pending}
              onClick={() =>
                run(() => updateRequest(requestId, { assigned_designer_id: designer }), "Designer assigned", () => setOpen(false))
              }
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReturnButton({ requestId }: { requestId: string }) {
  const { run, pending } = useRun();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <UndoIcon />
        Return
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Return this request</DialogTitle>
            <DialogDescription>
              The requester sees &ldquo;Returned&rdquo; with your reason and gets an email. They can file a new
              request with the missing details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="return-reason">Reason for return</Label>
            <Textarea
              id="return-reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Please add the copy and the logo files."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || pending}
              onClick={() => run(() => returnRequest(requestId, reason), "Request returned", () => setOpen(false))}
            >
              Return request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DesignerButtons({ requestId }: { requestId: string }) {
  const { run, pending } = useRun();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<"Full plate" | "Other concerns">("Full plate");
  const [note, setNote] = useState("");
  return (
    <>
      <Button size="sm" disabled={pending} onClick={() => run(() => respondAsDesigner(requestId, true, null), "Accepted")}>
        <CheckIcon />
        Accept
      </Button>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <RotateCcwIcon />
        Ask to reassign
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ask to reassign</DialogTitle>
            <DialogDescription>
              The request goes back to New request without a designer, and the reviewers see your reason.
            </DialogDescription>
          </DialogHeader>
          <RadioGroup value={category} onValueChange={(v) => setCategory(v as typeof category)} className="gap-2.5">
            {(["Full plate", "Other concerns"] as const).map((c) => (
              <div key={c} className="flex items-center gap-2.5">
                <RadioGroupItem id={`reassign-${c}`} value={c} />
                <Label htmlFor={`reassign-${c}`} className="font-normal">
                  {c}
                </Label>
              </div>
            ))}
          </RadioGroup>
          <div className="space-y-2">
            <Label htmlFor="reassign-note">
              Note {category === "Other concerns" ? <span className="text-destructive">*</span> : "(optional)"}
            </Label>
            <Textarea id="reassign-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending || (category === "Other concerns" && !note.trim())}
              onClick={() =>
                run(() => respondAsDesigner(requestId, false, { category, note }), "Reassignment requested", () => setOpen(false))
              }
            >
              Ask to reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
