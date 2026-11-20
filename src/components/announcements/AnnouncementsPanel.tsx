"use client";

import { MegaphoneIcon, XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { type Announcement, ANNOUNCEMENTS_SEEN_KEY, TONE_STYLES } from "@/lib/announcements";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { AnnouncementButton } from "./AnnouncementStrip";

// Which announcements this browser has opened the panel on (for the dot).
const listeners = new Set<() => void>();
function readSeen() {
  try {
    return localStorage.getItem(ANNOUNCEMENTS_SEEN_KEY) ?? "";
  } catch {
    return "";
  }
}
function markSeen(ids: string[]) {
  try {
    localStorage.setItem(ANNOUNCEMENTS_SEEN_KEY, ids.join(","));
  } catch {}
  listeners.forEach((fn) => fn());
}

// The megaphone in the main page's header: opens a side panel with every live
// announcement (banner or not), newest first. A dot shows when there's one
// this browser hasn't opened yet (owner, Nov 20).
export function AnnouncementsPanel({ items }: { items: Announcement[] }) {
  const [open, setOpen] = useState(false);
  const seen = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    readSeen,
    () => null,
  );
  const seenIds = new Set((seen ?? "").split(","));
  const unread = seen !== null && items.some((a) => !seenIds.has(a.id));

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) markSeen(items.map((a) => a.id));
      }}
    >
      <DialogPrimitive.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unread ? "Announcements (new)" : "Announcements"}
          title="Announcements"
          className="relative"
        >
          <MegaphoneIcon />
          {unread && (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 size-2 rounded-full bg-red-500 ring-2 ring-background"
            />
          )}
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/20 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-background shadow-xl duration-200 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right">
          <div className="flex items-center gap-2 border-b px-5 py-4">
            <MegaphoneIcon className="size-5 text-brand" aria-hidden />
            <DialogPrimitive.Title className="flex-1 font-brand text-lg font-bold">Announcements</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <XIcon />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">
            Important announcements from the Marketing team.
          </DialogPrimitive.Description>
          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {items.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No announcements right now.</p>
            ) : (
              items.map((a) => (
                <article key={a.id} className={cn("space-y-2 rounded-xl p-4", TONE_STYLES[a.tone].strip)}>
                  <h3 className="font-bold leading-snug">{a.headline}</h3>
                  {a.message && <p className="text-sm leading-relaxed">{a.message}</p>}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <p className="text-xs opacity-70">
                      {formatDate(a.startsOn)}
                      {a.endsOn && ` – ${formatDate(a.endsOn)}`}
                    </p>
                    <AnnouncementButton a={a} small />
                  </div>
                </article>
              ))
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
