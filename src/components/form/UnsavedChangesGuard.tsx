"use client";

import { useRouter } from "next/navigation";
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

// While `active` (there are unsaved changes), leaving the page asks first:
// links inside the app show a "Save your changes?" pop-up; closing or
// reloading the tab shows the browser's own warning.
export function UnsavedChangesGuard({ active, onSave }: { active: boolean; onSave: () => void }) {
  const router = useRouter();
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (!activeRef.current) return;
      e.preventDefault();
    }
    // Runs before Next.js's own link handling (capture phase on document).
    function click(e: MouseEvent) {
      if (!activeRef.current || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTo(url.pathname + url.search + url.hash);
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
    };
  }, []);

  return (
    <Dialog open={leaveTo !== null} onOpenChange={(open) => !open && setLeaveTo(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save your changes?</DialogTitle>
          <DialogDescription>You&apos;ve made changes to this request that aren&apos;t saved yet.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => setLeaveTo(null)}>
            Keep editing
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                const to = leaveTo!;
                activeRef.current = false;
                setLeaveTo(null);
                router.push(to);
              }}
            >
              Leave without saving
            </Button>
            <Button
              onClick={() => {
                setLeaveTo(null);
                onSave();
              }}
            >
              Save changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
