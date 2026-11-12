"use client";

import { CheckIcon, HandIcon, HourglassIcon, RotateCcwIcon, UndoIcon, UserCheckIcon, UserPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addMeAsDesigner, respondAsDesigner, returnRequest, setDesigners } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

// Phase 2 workflow (CLAUDE.md §8.1), top right of the staff Request Details:
// a tag showing where the request stands, and the buttons for whoever's turn
// it is. Reviewer (Super Admin / Lead Designer): Accept & assign (one or
// more designers), or Return. Each designer on the request: Accept, or Ask to
// reassign (owner, Nov 12: several designers, all equal).
export type WorkflowState = {
  requestId: string;
  status: string;
  // In the order added.
  designers: { id: string; name: string; response: string; respondedAt: string | null }[];
  returnReason: string | null;
  returnedByName: string | null;
  reassignReason: string | null;
  // The latest Ask to reassign while others stayed on the request.
  lastReassign: { name: string; reason: string } | null;
  // The note given when cancelling (by the requester, Oct 21, or the team,
  // Oct 22) and who cancelled it ("the requester" or a team member's name).
  cancelReason: string | null;
  cancelledByName: string | null;
};

export function WorkflowPanel({
  state,
  isManager,
  myDesignerId = null,
  canAddMe = false,
  designers,
}: {
  state: WorkflowState;
  isManager: boolean;
  // The viewer's own designer id (anyone in the Designer list can take a
  // fresh request for themselves, owner Oct 22).
  myDesignerId?: string | null;
  // Add me as a designer (owner, Nov 12): a designer not on it yet, once it
  // has a designer, until Completed / Cancelled / Returned.
  canAddMe?: boolean;
  designers: { id: string; name: string }[];
}) {
  const s = state;
  const hasDesigners = s.designers.length > 0;
  const canReview = isManager && s.status === "new_request";
  const canRespond = s.designers.some((d) => d.id === myDesignerId && d.response === "pending");
  const canTake = !!myDesignerId && s.status === "new_request" && !hasDesigners;
  const showButtons = (canReview && !hasDesigners) || canRespond || canTake;

  // When it's someone's turn, a highlighted bar spans the page under the
  // title with larger buttons, so the next step is hard to miss (owner,
  // Oct 22). Otherwise just the status tag sits top-right.
  if (showButtons) {
    const message = canRespond
      ? { title: "This request is waiting for you to accept it", hint: "Accept to take it on, or ask to reassign it if you can't." }
      : !canReview
        ? {
            title: "New request waiting for a designer",
            hint: "Take it if you can work on it. A Lead Designer can also assign it.",
          }
        : {
          title: s.reassignReason ? "Reassignment requested: pick another designer" : "New request waiting for review",
          hint: s.reassignReason ?? "Accept and assign a designer, or return it to the requester with a reason.",
        };
    return (
      <div
        role="region"
        aria-label="Action needed"
        className="flex basis-full flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-brand/40 bg-brand-soft p-4"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-white">
            <HourglassIcon className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-semibold">{message.title}</p>
            <p className="text-sm text-muted-foreground">{message.hint}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canRespond && <DesignerButtons requestId={s.requestId} alone={s.designers.length === 1} />}
          {canReview && !hasDesigners && (
            <AssignButton requestId={s.requestId} designers={designers} selfId={myDesignerId} />
          )}
          {canTake && <TakeButton requestId={s.requestId} primary={!canReview} />}
          {/* Return only before a designer is assigned (owner, Oct 20). */}
          {canReview && !hasDesigners && <ReturnButton requestId={s.requestId} />}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Tag state={s} />
      {canAddMe && <AddMeButton requestId={s.requestId} />}
    </div>
  );
}

const TONES = {
  waiting: "bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300",
  accepted: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300",
  closed: "bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300",
  reassign: "bg-orange-100 dark:bg-orange-500/20 text-orange-900 dark:text-orange-300",
  review: "bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300",
};

function Chip({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-medium", tone)}>{children}</span>;
}

// Where the request stands. With designers: one tag each, "Accepted by
// Sofia · Nov 12" or "Waiting for Dasha to accept" (owner, Nov 12).
function Tag({ state: s }: { state: WorkflowState }) {
  let detail: string | null = null;
  let tags: React.ReactNode;
  if (s.status === "rejected") {
    tags = <Chip tone={TONES.closed}>{`Returned${s.returnedByName ? ` by ${s.returnedByName}` : ""}`}</Chip>;
    detail = s.returnReason;
  } else if (s.status === "cancelled") {
    tags = <Chip tone={TONES.closed}>{s.cancelledByName ? `Cancelled by ${s.cancelledByName}` : "Cancelled"}</Chip>;
    detail = s.cancelReason;
  } else if (s.designers.length > 0) {
    tags = s.designers.map((d) =>
      d.response === "accepted" ? (
        <Chip key={d.id} tone={TONES.accepted}>
          {`Accepted by ${d.name}${d.respondedAt ? ` · ${formatDate(d.respondedAt)}` : ""}`}
        </Chip>
      ) : (
        <Chip key={d.id} tone={TONES.waiting}>{`Waiting for ${d.name} to accept`}</Chip>
      ),
    );
    if (s.lastReassign) detail = `${s.lastReassign.name} asked to reassign: ${s.lastReassign.reason}`;
  } else if (s.status === "new_request" && s.reassignReason) {
    tags = <Chip tone={TONES.reassign}>Reassignment requested</Chip>;
    detail = s.reassignReason;
  } else if (s.status === "new_request") {
    tags = <Chip tone={TONES.review}>Waiting for review</Chip>;
  } else {
    return null;
  }
  return (
    <div className="max-w-sm space-y-1 sm:text-right">
      <div className="flex flex-wrap gap-1.5 sm:justify-end">{tags}</div>
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

// Accept & assign: tick one or more designers (owner, Nov 12). Each gets an
// email and accepts on their own; ticking yourself counts as accepted.
function AssignButton({
  requestId,
  designers,
  selfId,
}: {
  requestId: string;
  designers: { id: string; name: string }[];
  selfId: string | null;
}) {
  const { run, pending } = useRun();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        <UserCheckIcon />
        Accept & assign
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setPicked([]);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Accept and assign designers</DialogTitle>
            <DialogDescription>
              Tick one or more. Each designer gets an email and can accept the task or ask to reassign it.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-2.5">
            <legend className="mb-2 text-sm font-medium">Designers</legend>
            {designers.map((d) => (
              <div key={d.id} className="flex items-center gap-2.5">
                <Checkbox
                  id={`assign-${d.id}`}
                  checked={picked.includes(d.id)}
                  onCheckedChange={(on) => setPicked((p) => (on === true ? [...p, d.id] : p.filter((x) => x !== d.id)))}
                />
                <Label htmlFor={`assign-${d.id}`} className="font-normal">
                  {d.id === selfId ? `${d.name} (me)` : d.name}
                </Label>
              </div>
            ))}
          </fieldset>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={picked.length === 0 || pending}
              onClick={() =>
                run(
                  () => setDesigners(requestId, picked),
                  picked.length > 1 ? "Designers assigned" : "Designer assigned",
                  () => setOpen(false),
                )
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
      <Button size="lg" variant="outline" onClick={() => setOpen(true)}>
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

function DesignerButtons({ requestId, alone }: { requestId: string; alone: boolean }) {
  const { run, pending } = useRun();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<"Full plate" | "Other concerns">("Full plate");
  const [note, setNote] = useState("");
  return (
    <>
      <Button size="lg" disabled={pending} onClick={() => run(() => respondAsDesigner(requestId, true, null), "Accepted")}>
        <CheckIcon />
        Accept
      </Button>
      <Button size="lg" variant="outline" onClick={() => setOpen(true)}>
        <RotateCcwIcon />
        Ask to reassign
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ask to reassign</DialogTitle>
            <DialogDescription>
              {alone
                ? "The request goes back to New request without a designer, and the reviewers see your reason."
                : "You're taken off this request (the other designers stay), and the reviewers see your reason."}
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

// Any designer can take a fresh request for themselves; it counts as
// accepted straight away (owner, Oct 22).
function TakeButton({ requestId, primary }: { requestId: string; primary: boolean }) {
  const { run, pending } = useRun();
  return (
    <Button
      size="lg"
      variant={primary ? "default" : "outline"}
      disabled={pending}
      onClick={() => run(() => addMeAsDesigner(requestId), "You took this request")}
    >
      <HandIcon />
      Take this request
    </Button>
  );
}

// Any designer can join a request that already has a designer; it counts as
// accepted and sends no emails (owner, Nov 12).
function AddMeButton({ requestId }: { requestId: string }) {
  const { run, pending } = useRun();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => run(() => addMeAsDesigner(requestId), "You were added as a designer")}
    >
      <UserPlusIcon />
      Add me as a designer
    </Button>
  );
}
