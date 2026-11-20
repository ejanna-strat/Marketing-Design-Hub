"use client";

import { ArrowUpRightIcon } from "lucide-react";
import { useState } from "react";
import { FaqAnswer } from "@/components/FaqAnswer";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Announcement, type Priority, PRIORITY_STYLES } from "@/lib/announcements";
import { cn } from "@/lib/utils";

type StripData = Pick<Announcement, "headline" | "message" | "linkLabel" | "linkUrl" | "details" | "priority">;

// One announcement as a banner strip: a bold headline, the message and an
// optional dark button (owner, Nov 20; like HubSpot's top banner). Used on the
// main page and as the preview in Settings → Announcements.
export function AnnouncementStrip({
  a,
  className,
  children,
}: {
  a: StripData;
  className?: string;
  // Extra controls on the right (dots, close button).
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative", PRIORITY_STYLES[a.priority].strip, className)}>
      <div
        data-strip-body
        className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-12 py-3 text-center text-sm sm:text-base"
      >
        <p className="min-w-0 leading-snug">
          <PriorityTag priority={a.priority} className="mr-2" />
          <strong className="font-bold">{a.headline}</strong>
          {a.message && <> {a.message}</>}
        </p>
        <AnnouncementButton a={a} />
      </div>
      {children}
    </div>
  );
}

// The small label before the headline ("URGENT", "NEW"…).
export function PriorityTag({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded px-1.5 py-0.5 align-[0.15em] text-[0.65rem] leading-none font-bold tracking-wider uppercase",
        PRIORITY_STYLES[priority].tag,
        className,
      )}
    >
      {PRIORITY_STYLES[priority].label}
    </span>
  );
}

const buttonClass =
  "inline-flex shrink-0 items-center gap-1 rounded-lg bg-gray-900 font-semibold text-white transition-colors hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 dark:focus-visible:outline-white";

// The button opens either a link (new tab) or the longer message in a pop-up
// (owner, Nov 20). No button when there's no button text.
export function AnnouncementButton({ a, small = false }: { a: StripData; small?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!a.linkLabel) return null;
  const size = small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";

  if (a.details) {
    return (
      <>
        <button type="button" onClick={() => setOpen(true)} className={cn(buttonClass, size)}>
          {a.linkLabel}
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="pr-6 text-xl leading-snug">{a.headline}</DialogTitle>
              {a.message ? (
                <DialogDescription>{a.message}</DialogDescription>
              ) : (
                <DialogDescription className="sr-only">Announcement details</DialogDescription>
              )}
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto text-sm leading-relaxed [&_a]:font-medium [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2">
              <FaqAnswer text={a.details} />
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (!a.linkUrl) return null;
  const external = a.linkUrl.startsWith("https://");
  return (
    <a
      href={a.linkUrl}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(buttonClass, size)}
    >
      {a.linkLabel}
      {external && <ArrowUpRightIcon className={small ? "size-3.5" : "size-4"} aria-hidden />}
      {external && <span className="sr-only"> (opens in a new tab)</span>}
    </a>
  );
}
