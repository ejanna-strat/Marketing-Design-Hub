"use client";

import { format, parseISO } from "date-fns";
import { CalendarIcon, PencilIcon, PlusIcon, UsersIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelRequest, type RequestPatch, setDesigners, updateRequest } from "@/app/admin/actions";
import { ConfirmLeaveDialog } from "@/components/form/UnsavedChangesGuard";
import { OutputLinkList, OutputLinksCell } from "@/components/LinkifiedText";
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
import {
  duplicateOf,
  isOutputLink,
  LINK_LABEL_MAX,
  linkSlots,
  OUTPUT_LINK_ERROR,
  type OutputLinkFields,
  outputLinks,
} from "@/lib/links";
import { digitsOnly } from "@/lib/money";
import { type RequestDesigner, sortDesigners } from "@/lib/requests/designers";
import { ADMIN_STATUSES, NEEDS_DESIGNER, STATUSES, statusBadgeClass } from "@/lib/statuses";
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
  holdOrCancelOnly = false,
  awaitingMe = false,
}: {
  requestId: string;
  value: string;
  label?: string;
  hasDesigner?: boolean;
  hasLink?: boolean;
  // The assigned designer has accepted the task.
  accepted?: boolean;
  // Admins who don't design: only On hold and Cancelled (owner, Oct 30).
  holdOrCancelOnly?: boolean;
  // The viewer is a designer on the request who hasn't accepted yet: no
  // status changes until they do (owner, Nov 12).
  awaitingMe?: boolean;
}) {
  const { save, pending } = useSave(requestId);
  const [current, setCurrent] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setCurrent(value);
  }
  useStatusUpdates(requestId, setCurrent);
  // Cancelling asks for a note first (owner, Oct 22).
  const [cancelling, setCancelling] = useState(false);

  return (
    <>
    <CancelDialog
      requestId={requestId}
      open={cancelling}
      onClose={() => setCancelling(false)}
      onCancelled={() => {
        setCancelling(false);
        setCurrent("cancelled");
      }}
    />
    <Select
      value={current}
      disabled={pending || awaitingMe}
      onValueChange={(next) => {
        if (next === "cancelled") {
          setCancelling(true);
          return;
        }
        const previous = current;
        setCurrent(next);
        save({ status: next as RequestPatch["status"] }, "Status updated", () => setCurrent(previous));
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={label ?? "Status"}
        title={awaitingMe ? "Accept the request first to change its status" : undefined}
        className={cn("h-7 max-w-56 rounded-full border-0 text-xs font-medium", statusBadgeClass(current))}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        {STATUSES.map((s) => {
          const reason =
            s.value === current
              ? null
              : holdOrCancelOnly && !ADMIN_STATUSES.has(s.value)
                ? "the designer sets this"
                : lockReason(s.value, hasDesigner, hasLink, accepted);
          return (
            <SelectItem key={s.value} value={s.value} disabled={!!reason}>
              {s.label}
              {reason && <span className="text-xs text-muted-foreground">· {reason}</span>}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
    </>
  );
}

function CancelDialog({
  requestId,
  open,
  onClose,
  onCancelled,
}: {
  requestId: string;
  open: boolean;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  function confirm() {
    startTransition(async () => {
      const result = await cancelRequest(requestId, note);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Request cancelled");
      setNote("");
      onCancelled();
      router.refresh();
    });
  }
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel this request</DialogTitle>
          <DialogDescription>
            The requester sees &ldquo;Cancelled&rdquo; with your note on their request page. Nobody is emailed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`cancel-note-${requestId}`}>
            Note <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id={`cancel-note-${requestId}`}
            rows={4}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. The event was moved to next year."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Keep request
          </Button>
          <Button variant="destructive" disabled={!note.trim() || pending} onClick={confirm}>
            Cancel request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function lockReason(status: string, hasDesigner: boolean, hasLink: boolean, accepted: boolean): string | null {
  if (status === "designer_assigned") return "set when the designer accepts";
  if (status === "rejected") return "use the Return button";
  if (!hasDesigner && NEEDS_DESIGNER.has(status as never)) return "assign a designer first";
  if (hasDesigner && !accepted && NEEDS_DESIGNER.has(status as never)) return "a designer must accept first";
  if (!hasLink && LINK_REQUIRED.has(status)) return "add a Link to Output first";
  if (accepted && status === "new_request") return "a designer already accepted";
  return null;
}

const LINK_REQUIRED = new Set(["for_review", "for_revision", "completed"]);

// A request's designers (owner, Nov 12: several, all equal). Everyone sees
// the names ("Sofia, Dasha"; "waiting" until that designer accepts); Super
// Admins and Lead Designers (`canEdit`) tick designers in a pop-up and save
// the whole list at once. Locked once Completed, Cancelled or Returned.
export function DesignersEditor({
  requestId,
  value,
  designers,
  canEdit = false,
  locked,
  selfId = null,
  compact = false,
}: {
  requestId: string;
  value: RequestDesigner[];
  designers: DesignerOption[];
  canEdit?: boolean;
  // The reason it's locked, shown on hover.
  locked?: string;
  // The viewer's own designer id: picking yourself counts as accepted.
  selfId?: string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const current = sortDesigners(value);
  const [picked, setPicked] = useState<string[]>([]);
  // Former designers stay listed only on requests they already have.
  const options = designers.filter((d) => d.active || current.some((c) => c.designer_id === d.id));
  const changed =
    picked.length !== current.length || picked.some((id) => !current.some((c) => c.designer_id === id));

  function save() {
    startTransition(async () => {
      const result = await setDesigners(requestId, picked);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Designers saved");
      if (result.status) statusListeners.get(requestId)?.forEach((fn) => fn(result.status!));
      setOpen(false);
      router.refresh();
    });
  }

  const names =
    current.length === 0 ? (
      <span className="text-muted-foreground">—</span>
    ) : (
      <span className={cn("whitespace-normal", compact && "text-xs")}>
        {current.map((d, i) => (
          <span key={d.designer_id}>
            {i > 0 && ", "}
            {d.designer?.display_name ?? "—"}
            {d.response === "pending" && <span className="text-muted-foreground"> (waiting)</span>}
          </span>
        ))}
      </span>
    );
  if (!canEdit) {
    return (
      <span className="inline-flex items-center gap-1" title={locked}>
        {names}
      </span>
    );
  }

  return (
    <div className="flex items-start gap-1">
      {names}
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setPicked(current.map((c) => c.designer_id));
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label="Add or remove designers" disabled={pending}>
            <UsersIcon />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Designers</p>
              <p className="text-xs text-muted-foreground">
                Each designer you add gets an email and accepts on their own. Adding yourself counts as accepted.
              </p>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {options.map((d) => {
                const id = `designer-${requestId}-${d.id}`;
                return (
                  <div key={d.id} className="flex items-center gap-2.5">
                    <Checkbox
                      id={id}
                      checked={picked.includes(d.id)}
                      onCheckedChange={(on) =>
                        setPicked((p) => (on === true ? [...p, d.id] : p.filter((x) => x !== d.id)))
                      }
                    />
                    <Label htmlFor={id} className="font-normal">
                      {d.id === selfId ? `${d.name} (me)` : d.active ? d.name : `${d.name} (former)`}
                    </Label>
                  </div>
                );
              })}
            </div>
            {picked.length === 0 && current.length > 0 && (
              <p className="text-xs text-muted-foreground">With no designers the request goes back to New request.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={pending || !changed} onClick={save}>
                Save
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// How many link slots to show: the filled ones, at least one (owner, Nov 4:
// the others appear with "Add output link").
const shownSlots = (slots: { url: string; label: string }[]) =>
  Math.max(1, slots.filter((s) => s.url.trim() || s.label.trim()).length);

// Up to three Links to Output, each with an optional name (owner, Nov 4).
// One pop-up edits all three; any one link is enough for review / Completed.
export function LinkEditor({
  requestId,
  links,
  locked,
  notStarted,
  compact,
}: {
  requestId: string;
  links: OutputLinkFields;
  locked?: boolean;
  // Links wait until the request has been In progress (owner, Nov 13).
  notStarted?: boolean;
  compact?: boolean;
}) {
  const { save, pending } = useSave(requestId);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => linkSlots(links));
  const [count, setCount] = useState(() => shownSlots(linkSlots(links)));
  // The field to focus: Link 1 on opening, a new link when it's added.
  const [focus, setFocus] = useState(0);
  const [touched, setTouched] = useState(false);
  const invalid = draft.map((d) => d.url.trim() !== "" && !isOutputLink(d.url.trim()));
  const nameOnly = draft.map((d) => !d.url.trim() && !!d.label.trim());
  // With 2 or more links each one needs a name; a single link's is optional
  // (owner, Nov 4).
  const namesNeeded = draft.filter((d) => d.url.trim()).length >= 2;
  const nameMissing = draft.map((d) => namesNeeded && !!d.url.trim() && !d.label.trim());
  const dupe = duplicateOf(draft.map((d) => d.url));
  const shown = outputLinks(links);
  const any = shown.length > 0;
  // Save only a real change with valid links (owner, Nov 4). Clearing every
  // link is allowed when some were saved before, to remove a wrong one.
  const saved = linkSlots(links);
  const changed = draft.some(
    (d, i) => d.url.trim() !== saved[i].url.trim() || d.label.trim() !== saved[i].label.trim(),
  );
  const filled = draft.some((d) => d.url.trim());
  const canSave =
    changed &&
    !invalid.some(Boolean) &&
    !nameOnly.some(Boolean) &&
    !nameMissing.some(Boolean) &&
    dupe.every((j) => j < 0) &&
    (filled || any);

  function update(i: number, part: Partial<{ url: string; label: string }>) {
    setDraft((d) => d.map((slot, j) => (j === i ? { ...slot, ...part } : slot)));
  }

  // Removing a link moves the ones below it up.
  function remove(i: number) {
    setDraft((d) => [...d.filter((_, j) => j !== i), { url: "", label: "" }]);
    setCount((c) => Math.max(1, c - 1));
  }

  return (
    <div className="flex items-start gap-1">
      {compact ? <OutputLinksCell links={shown} /> : <OutputLinkList links={shown} />}
      {!locked && notStarted && !compact && !any && (
        <span className="text-xs text-muted-foreground">Add once it&apos;s In progress</span>
      )}
      {!locked && !notStarted && (
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) {
              const slots = linkSlots(links);
              setDraft(slots);
              setCount(shownSlots(slots));
              setFocus(0);
              setTouched(false);
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={any ? "Edit Links to Output" : "Add Link to Output"}>
              <PencilIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-96">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setTouched(true);
                if (!canSave) return;
                const [a, b, c] = draft;
                save(
                  {
                    link_to_output: a.url,
                    link_label_1: a.label,
                    link_to_output_2: b.url,
                    link_label_2: b.label,
                    link_to_output_3: c.url,
                    link_label_3: c.label,
                  },
                  filled ? "Links to Output saved" : "Links to Output removed",
                );
                setOpen(false);
              }}
            >
              <div>
                <p className="text-sm font-medium">Links to Output</p>
                <p className="text-xs text-muted-foreground">
                  One link can go without a name (it shows as “Open link”). With 2 or more, give each one a name.
                </p>
              </div>
              {draft.slice(0, count).map((slot, i) => (
                <fieldset key={i} className="space-y-1.5">
                  <legend className="mb-1.5 flex w-full items-center justify-between text-xs font-medium">
                    <span className="text-muted-foreground">Link {i + 1}</span>
                    {i > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove link ${i + 1}`}
                        onClick={() => remove(i)}
                      >
                        <XIcon />
                      </Button>
                    )}
                  </legend>
                  <Input
                    aria-label={`Link ${i + 1} name`}
                    placeholder={namesNeeded ? "Name" : "Name (optional)"}
                    aria-invalid={(touched && nameMissing[i]) || undefined}
                    maxLength={LINK_LABEL_MAX}
                    value={slot.label}
                    onChange={(e) => update(i, { label: e.target.value })}
                    onBlur={() => setTouched(true)}
                  />
                  <Input
                    aria-label={`Link ${i + 1}`}
                    placeholder="https://…"
                    value={slot.url}
                    onChange={(e) => update(i, { url: e.target.value })}
                    onBlur={() => setTouched(true)}
                    aria-invalid={(touched && invalid[i]) || undefined}
                    autoFocus={i === focus}
                  />
                  {touched && invalid[i] && <p className="text-xs text-destructive">{OUTPUT_LINK_ERROR}</p>}
                  {dupe[i] >= 0 && <p className="text-xs text-destructive">Same link as Link {dupe[i] + 1}.</p>}
                  {touched && nameMissing[i] && (
                    <p className="text-xs text-destructive">Add a name — needed when there are 2 or more links.</p>
                  )}
                  {touched && nameOnly[i] && (
                    <p className="text-xs text-destructive">
                      {i === 0 ? "Add the link, or clear the name." : "Add the link, or remove this one."}
                    </p>
                  )}
                </fieldset>
              ))}
              {count < draft.length && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFocus(count);
                    setCount(count + 1);
                  }}
                >
                  <PlusIcon />
                  Add output link
                </Button>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={pending || !canSave}>
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

function DatePickerField({ id, value, onChange }: { id: string; value: string; onChange: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" className="w-full justify-start font-normal">
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
            onChange(format(d, "yyyy-MM-dd"));
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
  // yyyy-MM-dd
  dateNeeded: string;
};

// Edit the request's title and General Information (any Marketing team
// member), including Date Needed (owner, Oct 22; it also keeps its own quick
// editor in the Pipeline section).
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
    form.dateNeeded !== value.dateNeeded ||
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
    if (form.dateNeeded !== value.dateNeeded) patch.date_needed = form.dateNeeded;
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
            <div className="space-y-2">
              <Label htmlFor="gi-date">Date Needed</Label>
              <DatePickerField
                id="gi-date"
                value={form.dateNeeded}
                onChange={(dateNeeded) => setForm({ ...form, dateNeeded })}
              />
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
