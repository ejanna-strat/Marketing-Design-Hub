"use client";

import { XIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { type Announcement, BANNER_CLOSED_KEY } from "@/lib/announcements";
import { cn } from "@/lib/utils";
import { AnnouncementStrip } from "./AnnouncementStrip";

const ROTATE_MS = 7000;

// Closing the banner lasts until sign-out or the tab is closed (sessionStorage,
// owner Nov 20). The key holds which banners were closed, so a new or edited
// one shows again.
const listeners = new Set<() => void>();
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function readClosed() {
  try {
    return sessionStorage.getItem(BANNER_CLOSED_KEY) ?? "";
  } catch {
    return "";
  }
}
function writeClosed(value: string) {
  try {
    sessionStorage.setItem(BANNER_CLOSED_KEY, value);
  } catch {}
  listeners.forEach((fn) => fn());
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (fn) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", fn);
      return () => mq.removeEventListener("change", fn);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}

// The main page's top banner: up to 3 announcements that take turns every
// few seconds (paused while the pointer or keyboard is on it, and for people
// who turn motion off). Dots jump to one; ✕ hides the banner.
export function AnnouncementBanner({ items }: { items: Announcement[] }) {
  const signature = items.map((a) => `${a.id}:${a.updatedAt}`).join("|");
  // null until the browser has checked whether it was closed (no flash).
  const closed = useSyncExternalStore(
    subscribe,
    () => readClosed() === signature,
    () => null,
  );
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = items.length;
  const current = items[Math.min(index, count - 1)];

  useEffect(() => {
    if (count < 2 || paused || reduced || closed !== false) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(t);
  }, [count, paused, reduced, closed]);

  if (!current || closed !== false) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Announcements"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
      className="border-b animate-in fade-in-0 duration-300"
    >
      <AnnouncementStrip
        key={current.id}
        a={current}
        className={cn(
          "transition-colors duration-500",
          count > 1 && "[&>[data-strip-body]]:pb-6",
          !reduced &&
            "[&>[data-strip-body]]:animate-in [&>[data-strip-body]]:fade-in-0 [&>[data-strip-body]]:duration-500",
        )}
      >
        {count > 1 && (
          <div className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1.5">
            {items.map((a, i) => (
              <button
                key={a.id}
                type="button"
                aria-label={`Show announcement ${i + 1} of ${count}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => setIndex(i)}
                className="group p-1"
              >
                <span
                  className={cn(
                    "block size-1.5 rounded-full bg-current transition-opacity",
                    i === index ? "opacity-80" : "opacity-25 group-hover:opacity-50",
                  )}
                />
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          aria-label="Close the announcements banner"
          title="Close (it comes back the next time you sign in)"
          onClick={() => writeClosed(signature)}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 opacity-60 transition hover:bg-black/5 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-current dark:hover:bg-white/10 sm:right-4"
        >
          <XIcon className="size-4" />
        </button>
      </AnnouncementStrip>
    </section>
  );
}
