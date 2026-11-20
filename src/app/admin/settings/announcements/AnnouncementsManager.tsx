"use client";

import { format, parseISO } from "date-fns";
import { CalendarIcon, CheckIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AnnouncementStrip, PriorityTag } from "@/components/announcements/AnnouncementStrip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  type Announcement,
  MAX_IN_BANNER,
  type Phase,
  phaseOf,
  byPriority,
  type Priority,
  PRIORITIES,
  PRIORITY_STYLES,
} from "@/lib/announcements";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { FaqAnswerEditor } from "../faqs/FaqAnswerEditor";
import { deleteAnnouncement, saveAnnouncement } from "./actions";

type Form = {
  id: string;
  headline: string;
  message: string;
  linkLabel: string;
  buttonAction: "link" | "details";
  linkUrl: string;
  details: string;
  priority: Priority;
  inBanner: boolean;
  startsOn: string;
  endsOn: string | null;
};

const GROUPS: { phase: Phase; title: string; empty?: string }[] = [
  { phase: "live", title: "Live now", empty: "Nothing on the main page right now." },
  { phase: "scheduled", title: "Scheduled" },
  { phase: "ended", title: "Ended" },
];

export function AnnouncementsManager({ announcements, today }: { announcements: Announcement[]; today: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Form | null>(null);
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const [pending, startTransition] = useTransition();

  const bannerCount = announcements.filter((a) => a.inBanner && phaseOf(a, today) !== "ended").length;

  function add() {
    setEditing({
      id: "",
      headline: "",
      message: "",
      linkLabel: "",
      buttonAction: "link",
      linkUrl: "",
      details: "",
      priority: "new",
      inBanner: bannerCount < MAX_IN_BANNER,
      startsOn: today,
      endsOn: null,
    });
  }

  function edit(a: Announcement) {
    setEditing({
      id: a.id,
      headline: a.headline,
      message: a.message,
      linkLabel: a.linkLabel ?? "",
      buttonAction: a.details ? "details" : "link",
      linkUrl: (a.linkUrl ?? "").replace(/^mailto:/, ""),
      details: a.details ?? "",
      priority: a.priority,
      inBanner: a.inBanner,
      startsOn: a.startsOn,
      endsOn: a.endsOn,
    });
  }

  function remove(a: Announcement) {
    startTransition(async () => {
      const result = await deleteAnnouncement(a.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("The announcement was deleted");
      setDeleting(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Top banner: {Math.min(bannerCount, MAX_IN_BANNER)} of {MAX_IN_BANNER} used (live or scheduled).
        </p>
        <Button onClick={add}>
          <PlusIcon />
          Add announcement
        </Button>
      </div>

      {GROUPS.map((g) => {
        const items = announcements.filter((a) => phaseOf(a, today) === g.phase).sort(byPriority);
        if (items.length === 0 && !g.empty) return null;
        return (
          <section key={g.phase} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">{g.title}</h2>
            <ul className={cn("divide-y rounded-xl border bg-background", g.phase === "ended" && "opacity-70")}>
              {items.length === 0 ? (
                <li className="p-6 text-center text-sm text-muted-foreground">{g.empty}</li>
              ) : (
                items.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 p-4">
                    <span
                      aria-hidden
                      className={cn("mt-1 size-4 shrink-0 rounded-full ring-1", PRIORITY_STYLES[a.priority].swatch)}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium">
                        <PriorityTag priority={a.priority} className="mr-2" />
                        {a.headline}
                        <Badge variant="secondary" className="ml-2 align-middle">
                          {a.inBanner ? "Banner + panel" : "Panel only"}
                        </Badge>
                      </p>
                      {a.message && <p className="line-clamp-2 text-sm text-muted-foreground">{a.message}</p>}
                      <p className="text-xs text-muted-foreground">
                        {formatDate(a.startsOn)} – {a.endsOn ? formatDate(a.endsOn) : "no end date"}
                        {a.linkLabel &&
                          ` · Button: ${a.linkLabel} (${a.details ? "opens a longer message" : "opens a link"})`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit "${a.headline}"`}
                        onClick={() => edit(a)}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete "${a.headline}"`}
                        onClick={() => setDeleting(a)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>
        );
      })}

      {editing && (
        <AnnouncementDialog
          key={editing.id || "new"}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this announcement?</DialogTitle>
            <DialogDescription>
              &ldquo;{deleting?.headline}&rdquo; will be removed from the main page and can&apos;t be brought back. To
              take it down for now, edit it and set an end date instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={pending} onClick={() => deleting && remove(deleting)}>
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AnnouncementDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: Form;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !initial.id;
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await saveAnnouncement({
        id: form.id || undefined,
        headline: form.headline,
        message: form.message,
        linkLabel: form.linkLabel,
        buttonAction: form.buttonAction,
        linkUrl: form.linkUrl,
        details: form.details,
        priority: form.priority,
        inBanner: form.inBanner,
        startsOn: form.startsOn,
        endsOn: form.endsOn,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(isNew ? "The announcement was added" : "The announcement was updated");
      onSaved();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{isNew ? "Add announcement" : "Edit announcement"}</DialogTitle>
            <DialogDescription>It shows on the main page from the start date.</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Preview</p>
            <AnnouncementStrip
              className="overflow-hidden rounded-lg border [&_a]:pointer-events-none [&>[data-strip-body]]:px-4"
              a={{
                headline: form.headline || "Your headline",
                message: form.message,
                linkLabel: form.linkLabel || null,
                linkUrl: form.linkLabel && form.buttonAction === "link" ? "#" : null,
                details: form.buttonAction === "details" ? form.details || "Your longer message" : null,
                priority: form.priority,
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ann-headline">Headline (bold)</Label>
            <Input
              id="ann-headline"
              maxLength={80}
              placeholder="e.g. Holiday schedule is here!"
              value={form.headline}
              onChange={(e) => set({ headline: e.target.value })}
              required
              autoFocus={isNew}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ann-message">Message (optional)</Label>
            <Textarea
              id="ann-message"
              rows={2}
              maxLength={240}
              placeholder="One or two short sentences."
              value={form.message}
              onChange={(e) => set({ message: e.target.value })}
            />
            <p className="text-right text-xs text-muted-foreground">{form.message.length}/240</p>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <div className="space-y-2">
              <Label htmlFor="ann-link-label">Button text (optional)</Label>
              <Input
                id="ann-link-label"
                maxLength={30}
                placeholder="e.g. Learn more"
                value={form.linkLabel}
                onChange={(e) => set({ linkLabel: e.target.value })}
                className="sm:max-w-xs"
              />
            </div>
            {form.linkLabel.trim() && (
              <>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">When someone clicks it</legend>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["link", "Open a link"],
                        ["details", "Show a longer message"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={form.buttonAction === value}
                        onClick={() => set({ buttonAction: value })}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                          form.buttonAction === value ? "border-brand ring-2 ring-brand/30" : "hover:bg-muted",
                        )}
                      >
                        {form.buttonAction === value && <CheckIcon className="size-3.5 text-brand" aria-hidden />}
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                {form.buttonAction === "link" ? (
                  <div className="space-y-2">
                    <Label htmlFor="ann-link-url">Link</Label>
                    <Input
                      id="ann-link-url"
                      placeholder="https://… or name@stratpoint.com"
                      value={form.linkUrl}
                      onChange={(e) => set({ linkUrl: e.target.value })}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label id="ann-details-label">Longer message</Label>
                    <FaqAnswerEditor
                      labelId="ann-details-label"
                      initial={initial.details}
                      onChange={(details) => set({ details })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Opens in a pop-up. Highlight words and use the buttons above for bold, italic, underline, links
                      and bullets. Click the button in the preview to see it.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Priority</legend>
            <p className="text-xs text-muted-foreground">
              The colour follows the priority, and higher priority shows first. Do they need to act today? Urgent. Will
              it affect them soon? Important. Is it something new they can use? New. Anything else: FYI.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={form.priority === p}
                  onClick={() => set({ priority: p })}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors",
                    form.priority === p ? "border-brand ring-2 ring-brand/30" : "hover:bg-muted",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("mt-0.5 size-4 shrink-0 rounded-full ring-1", PRIORITY_STYLES[p].swatch)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {PRIORITY_STYLES[p].label}
                      {form.priority === p && <CheckIcon className="size-3.5 text-brand" aria-hidden />}
                    </span>
                    <span className="block text-xs leading-snug text-muted-foreground">
                      {PRIORITY_STYLES[p].description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ann-start">Start date</Label>
              <DateField id="ann-start" value={form.startsOn} onChange={(d) => d && set({ startsOn: d })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ann-end">End date (optional)</Label>
              <DateField
                id="ann-end"
                value={form.endsOn}
                onChange={(d) => set({ endsOn: d })}
                emptyText="No end date"
                minDate={form.startsOn}
              />
              <p className="text-xs text-muted-foreground">It disappears after this day.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Checkbox
              id="ann-banner"
              checked={form.inBanner}
              onCheckedChange={(on) => set({ inBanner: on === true })}
              className="mt-0.5"
            />
            <Label htmlFor="ann-banner" className="block font-normal leading-snug">
              <span className="font-medium">Show in the top banner</span>
              <span className="block text-xs text-muted-foreground">
                Up to {MAX_IN_BANNER} at a time. Untick to list it in the megaphone panel only.
              </span>
            </Label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isNew ? "Add announcement" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DateField({
  id,
  value,
  onChange,
  emptyText,
  minDate,
}: {
  id: string;
  value: string | null;
  onChange: (date: string | null) => void;
  emptyText?: string;
  minDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;
  return (
    <div className="flex gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" className="flex-1 justify-start font-normal">
            <CalendarIcon className="text-muted-foreground" />
            {value ? formatDate(value) : <span className="text-muted-foreground">{emptyText}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? (minDate ? parseISO(minDate) : undefined)}
            disabled={minDate ? { before: parseISO(minDate) } : undefined}
            onSelect={(d) => {
              if (!d) return;
              setOpen(false);
              onChange(format(d, "yyyy-MM-dd"));
            }}
          />
        </PopoverContent>
      </Popover>
      {emptyText && value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear the end date"
          onClick={() => onChange(null)}
        >
          <XIcon />
        </Button>
      )}
    </div>
  );
}
