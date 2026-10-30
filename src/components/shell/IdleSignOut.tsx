"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ACTIVE_COOKIE, ACTIVE_MAX_AGE, IDLE_LIMIT_MS, SIGN_OUT_PATH, WARN_BEFORE_MS } from "@/lib/idle";
import { SYNCED_KEY } from "./UserMenu";

const ACTIVITY = ["pointerdown", "keydown", "scroll", "wheel", "touchstart"] as const;

function lastActive() {
  const m = document.cookie.match(new RegExp(`(?:^|; )${ACTIVE_COOKIE}=(\\d+)`));
  return m ? Number(m[1]) : 0;
}

function markActive() {
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${ACTIVE_COOKIE}=${Date.now()}; path=/; max-age=${ACTIVE_MAX_AGE}; samesite=lax${secure}`;
}

async function signOutNow() {
  try {
    await fetch(SIGN_OUT_PATH, { method: "POST" });
  } catch {}
  // The next person to sign in on this browser gets their own saved theme.
  try {
    sessionStorage.removeItem(SYNCED_KEY);
  } catch {}
  const here = location.pathname + location.search;
  const next = here === "/" ? "" : `&next=${encodeURIComponent(here)}`;
  location.replace(`/login?reason=idle${next}`);
}

// Auto sign-out in the browser (src/lib/idle.ts): clicks, typing and
// scrolling in any tab count as activity; 5 minutes before the limit a
// "Still there?" pop-up counts down. The middleware does the same check on
// every page load, which covers closed tabs and sleeping laptops.
export function IdleSignOut({ team }: { team: boolean }) {
  const limit = team ? IDLE_LIMIT_MS.team : IDLE_LIMIT_MS.requester;
  // Time left while the warning shows.
  const [left, setLeft] = useState<number | null>(null);
  const warning = useRef(false);
  useEffect(() => {
    warning.current = left !== null;
  }, [left]);

  useEffect(() => {
    let wrote = 0;
    let leaving = false;
    function activity() {
      // Once the warning shows, only "Stay signed in" counts.
      if (warning.current || Date.now() - wrote < 30_000) return;
      wrote = Date.now();
      markActive();
    }
    function check() {
      if (leaving) return;
      const last = lastActive();
      if (!last) {
        markActive();
        return;
      }
      const remaining = last + limit - Date.now();
      if (remaining <= 0) {
        leaving = true;
        void signOutNow();
        return;
      }
      // Another tab's activity (or its "Stay signed in") closes the warning here too.
      setLeft(remaining <= WARN_BEFORE_MS ? remaining : null);
    }
    ACTIVITY.forEach((e) => window.addEventListener(e, activity, { capture: true, passive: true }));
    document.addEventListener("visibilitychange", check);
    const timer = window.setInterval(check, 1000);
    check();
    return () => {
      ACTIVITY.forEach((e) => window.removeEventListener(e, activity, { capture: true }));
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(timer);
    };
  }, [limit]);

  function stay() {
    markActive();
    setLeft(null);
  }

  const seconds = Math.max(0, Math.ceil((left ?? 0) / 1000));
  const countdown = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <Dialog open={left !== null} onOpenChange={(open) => !open && stay()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Still there?</DialogTitle>
          <DialogDescription>
            For your security, you&apos;ll be signed out in{" "}
            <span className="font-medium text-foreground tabular-nums">{countdown}</span> because there&apos;s been no
            activity. You&apos;ll come back to this page after signing in.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => void signOutNow()}>
            Sign out
          </Button>
          <Button type="button" onClick={stay} autoFocus>
            Stay signed in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
