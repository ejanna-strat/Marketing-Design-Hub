"use client";

import { format, parseISO } from "date-fns";
import { CalendarIcon, PencilIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { type RequestPatch, updateRequest } from "@/app/admin/actions";
import { ConfirmLeaveDialog } from "@/components/form/UnsavedChangesGuard";
import { OutputLink } from "@/components/LinkifiedText";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/dates";
import { isOutputLink, OUTPUT_LINK_ERROR } from "@/lib/links";
import { digitsOnly } from "@/lib/money";
import { NEEDS_DESIGNER, STATUSES, statusBadgeClass } from "@/lib/statuses";
import { cn } from "@/lib/utils";

// Inline editors for pipeline fields, used in the Pipeline table and on the
// admin Request Details page. Each change is saved straight away.

export type DesignerOption = { id: string; name: string; active: boolean };

// The status can change automatically (e.g. removing the designer → New
// request). The saved status is passed straight to that request's Status
// dropdown so it updates at once, before the page finishes refreshing
// (owner, Oct 21).
const statusListeners = new Map<string, Set<(status: string) => void>>();

function useStatusUpdates(requestId: string, onStatus: (status: string) => void) {
  const listener = useRef(onStatus);
  listener.current = onStatus;
  useEffect(() => {
    const fn = (s: string) => listener.current(s);
    const set = statusListeners.get(requestId) ?? new Set();
    set.add(fn);
    statusListeners.set(requestId, set);
    return () => {
      set.delete(fn);
    };
  }, [requestId]);
}

function useSave(requestId: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function save(patch: RequestPatch, success: string, onError?: () => void) {
    startTransition(async () => {
      const result = await updateRequest(requestId, patch);
      if (result.ok) {
        toast.success(success);
        if (result.status) statusListeners.get(requestId)?.forEach((fn) => fn(result.status!));
        router.refresh();
      } else {
        toast.error(result.error);
        onError?.();
      }
    });
  }
  return { save, pending };
}

// Statuses that can't be picked right now are greyed out with the reason:
// "Designer assigned" comes from the designer's Accept, "Returned" from the
// Return button, work statuses need a designer, For requester's review / For
// revision / Completed need a Link to Output, and New request is closed once
// the designer has accepted. The database enforces the same rules.
export function StatusSelect({
  requestId,
  value,
  label,
  hasDesigner = true,
  hasLink = true,
  accepted = false,
}: {
  requestId: string;
  value: string;
  label?: string;
  hasDesigner?: boolean;
  hasLink?: boolean;
  // The assigned designer has accepted the task.
  accepted?: boolean;
}) {
  const { save, pending } = useSave(requestId);
  const [current, setCurrent] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setCurrent(value);
  }
  useStatusUpdates(requestId, setCurrent);

  return (
    <Select
      value={current}
      disabled={pending}
      onValueChange={(next) => {
        const previous = current;
        setCurrent(next);
        save({ status: next as RequestPatch["status"] }, "Status updated", () => setCurrent(previous));
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={label ?? "Status"}
        className={cn("h-7 max-w-56 rounded-full border-0 text-xs font-medium", statusBadgeClass(current))}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        {STATUSES.map((s) => {
          const reason = s.value === current ? null : lockReason(s.value, hasDesigner, hasLink, accepted);
          return (
            <SelectItem key={s.value} value={s.value} disabled={!!reason}>
              {s.label}
              {reason && <span className="text-xs text-muted-foreground">· {reason}</span>}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function lockReason(status: string, hasDesigner: boolean, hasLink: boolean, accepted: boolean): string | null {
  if (status === "designer_assigned") return "set when the designer accepts";
  if (status === "rejected") return "use the Return button";
  if (!hasDesigner && NEEDS_DESIGNER.has(status as never)) return "assign a designer first";
  if (hasDesigner && !accepted && NEEDS_DESIGNER.has(status as never)) return "the designer must accept first";
  if (!hasLink && LINK_REQUIRED.has(status)) return "add a Link to Output first";
  if (accepted && status === "new_request") return "the designer already accepted";
  return null;
}

const LINK_REQUIRED = new Set(["for_review", "for_revision", "completed"]);

const UNASSIGNED = "__none__";

// Locked once the request is Completed, Cancelled or Returned.
export function DesignerSelect({
  requestId,
  value,
  designers,
  locked,
}: {
  requestId: string;
  value: string | null;
  designers: DesignerOption[];
  // The reason it's locked, shown on hover.
  locked?: string;
}) {
  const { save, pending } = useSave(requestId);
  const [current, setCurrent] = useState(value ?? UNASSIGNED);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setCurrent(value ?? UNASSIGNED);
  }
  // Former designers stay listed only on requests they already have.
  const options = designers.filter((d) => d.active || d.id === value);

  return (
    <Select
      value={current}
      disabled={pending || !!locked}
      onValueChange={(next) => {
        const previous = current;
        setCurrent(next);
        save(
          { assigned_designer_id: next === UNASSIGNED ? null : next },
          next === UNASSIGNED ? "Designer removed" : "Designer assigned",
          () => setCurrent(previous),
        );
      }}
    >
      <SelectTrigger size="sm" aria-label="Assigned Designer"
        title={locked} className="h-7 min-w-32 bg-background text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectItem value={UNASSIGNED}>
          <span className="text-muted-foreground">— Unassigned</span>
        </SelectItem>
        {options.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function LinkEditor({ requestId, value, locked }: { requestId: string; value: string | null; locked?: boolean }) {
  const { save, pending } = useSave(requestId);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [touched, setTouched] = useState(false);
  const invalid = draft.trim() !== "" && !isOutputLink(draft.trim());

  return (
    <div className="flex items-center gap-1">
      <OutputLink value={value} />
      {!locked && (
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) {
              setDraft(value ?? "");
              setTouched(false);
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={value ? "Edit Link to Output" : "Add Link to Output"}>
              <PencilIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setTouched(true);
                if (invalid) return;
                save({ link_to_output: draft }, draft.trim() ? "Link to Output saved" : "Link to Output removed");
                setOpen(false);
              }}
            >
              <label className="text-sm font-medium" htmlFor={`link-${requestId}`}>
                Link to Output
              </label>
              <Input
                id={`link-${requestId}`}
                placeholder="https://…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => setTouched(true)}
                aria-invalid={(touched && invalid) || undefined}
                autoFocus
              />
              {touched && invalid && <p className="text-xs text-destructive">{OUTPUT_LINK_ERROR}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={pending}>
                  Save
                </Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export function DateNeededEditor({ requestId, value }: { requestId: string; value: string }) {
  const { save, pending } = useSave(requestId);
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending} aria-label="Change Date Needed" className="font-normal">
          <CalendarIcon className="text-muted-foreground" />
          {formatDate(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parseISO(value)}
          defaultMonth={parseISO(value)}
          onSelect={(d) => {
            if (!d) return;
            setOpen(false);
            const next = format(d, "yyyy-MM-dd");
            if (next !== value) save({ date_needed: next }, "Date Needed updated");
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export type GeneralInfo = {
  title: string;
  projectOverview: string;
  requesterName: string;
  teamId: string;
  approverName: string;
  approverEmail: string;
  isDeal: boolean;
  dealName: string;
  // whole pesos as digits ("" when none)
  dealSize: string;
};

// Edit the request's title and General Information (any Marketing team
// member). Date Needed has its own editor next to it.
export function GeneralInfoEditor({
  requestId,
  value,
  teams,
}: {
  requestId: string;
  value: GeneralInfo;
  teams: { id: string; name: string }[];
}) {
  const { save, pending } = useSave(requestId);
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState(value);
  const changed =
    form.title.trim() !== value.title ||
    form.projectOverview.trim() !== value.projectOverview ||
    form.requesterName.trim() !== value.requesterName ||
    form.teamId !== value.teamId ||
    form.approverName.trim() !== value.approverName ||
    form.approverEmail.trim().toLowerCase() !== value.approverEmail.toLowerCase() ||
    form.isDeal !== value.isDeal ||
    (form.isDeal && (form.dealName.trim() !== value.dealName || form.dealSize !== value.dealSize));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const patch: RequestPatch = {};
    if (form.title.trim() !== value.title) patch.title = form.title;
    if (form.projectOverview.trim() !== value.projectOverview) {
      if (!form.projectOverview.trim()) {
        toast.error("Please answer: Project Overview and Objective");
        return;
      }
      patch.project_overview = form.projectOverview;
    }
    if (form.requesterName.trim() !== value.requesterName) patch.requester_name = form.requesterName;
    if (form.teamId !== value.teamId) patch.team_id = form.teamId;
    if (form.approverName.trim() !== value.approverName) patch.final_approver_name = form.approverName;
    if (form.approverEmail.trim().toLowerCase() !== value.approverEmail.toLowerCase()) {
      patch.final_approver_email = form.approverEmail;
    }
    const dealChanged =
      form.isDeal !== value.isDeal || (form.isDeal && (form.dealName.trim() !== value.dealName || form.dealSize !== value.dealSize));
    if (dealChanged) {
      if (form.isDeal && (!form.dealName.trim() || !form.dealSize)) {
        toast.error("Please enter the deal name and deal size.");
        return;
      }
      patch.is_deal = form.isDeal;
      patch.deal_name = form.isDeal ? form.dealName : null;
      patch.deal_size = form.isDeal ? Number(form.dealSize) : null;
    }
    save(patch, "Request details updated");
    setOpen(false);
  }

  const set = (key: keyof GeneralInfo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <>
      <ConfirmLeaveDialog
        open={confirmClose}
        title="Save your changes?"
        description="You've changed this request's details but haven't saved them yet."
        saveLabel="Save changes"
        stayLabel="Keep editing"
        leaveLabel="Discard changes"
        onStay={() => setConfirmClose(false)}
        onLeave={() => {
          setConfirmClose(false);
          setOpen(false);
        }}
        onSave={() => {
          setConfirmClose(false);
          formRef.current?.requestSubmit();
        }}
      />
      <Dialog
        open={open}
        onOpenChange={(next) => {
          // Closing with unsaved changes asks first.
          if (!next && changed) {
            setConfirmClose(true);
            return;
          }
          setOpen(next);
          if (next) setForm(value);
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <PencilIcon />
            Edit details
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <form ref={formRef} onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Edit request details</DialogTitle>
              <DialogDescription>Changes are saved to the activity log. The type of request can&apos;t change.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="gi-title">Request Title</Label>
              <Input id="gi-title" value={form.title} onChange={set("title")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gi-overview">Project Overview and Objective</Label>
              <Textarea id="gi-overview" rows={4} value={form.projectOverview} onChange={set("projectOverview")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gi-name">Requester&apos;s Name</Label>
              <Input id="gi-name" value={form.requesterName} onChange={set("requesterName")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gi-team">Business Unit</Label>
              <Select value={form.teamId} onValueChange={(teamId) => setForm({ ...form, teamId })}>
                <SelectTrigger id="gi-team" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gi-approver">Final Approver</Label>
                <Input id="gi-approver" value={form.approverName} onChange={set("approverName")} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gi-approver-email">Approver Email</Label>
                <Input id="gi-approver-email" type="email" value={form.approverEmail} onChange={set("approverEmail")} required />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <Checkbox id="gi-deal" checked={form.isDeal} onCheckedChange={(on) => setForm({ ...form, isDeal: on === true })} />
                <Label htmlFor="gi-deal">Associated with a deal</Label>
              </div>
              {form.isDeal && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="gi-deal-name">Deal Name</Label>
                    <Input id="gi-deal-name" value={form.dealName} onChange={set("dealName")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gi-deal-size">Deal Size (PHP)</Label>
                    <Input
                      id="gi-deal-size"
                      inputMode="numeric"
                      value={form.dealSize ? Number(form.dealSize).toLocaleString("en-PH") : ""}
                      onChange={(e) => setForm({ ...form, dealSize: digitsOnly(e.target.value).slice(0, 15) })}
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => (changed ? setConfirmClose(true) : setOpen(false))}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !changed}>
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
