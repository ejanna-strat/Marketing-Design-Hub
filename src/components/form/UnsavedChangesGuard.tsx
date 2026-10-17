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
// links inside the app show a pop-up; closing or reloading the tab shows the
// browser's own warning.
export function UnsavedChangesGuard({
  active,
  onSave,
  title = "Save your changes?",
  description = "You've made changes to this request that aren't saved yet.",
  saveLabel = "Save changes",
  leaveLabel = "Leave without saving",
  stayLabel = "Keep editing",
}: {
  active: boolean;
  // Omit to offer only "stay" or "leave" (e.g. a form that isn't complete yet).
  onSave?: () => void;
  title?: string;
  description?: string;
  saveLabel?: string;
  leaveLabel?: string;
  stayLabel?: string;
}) {
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
    <ConfirmLeaveDialog
      open={leaveTo !== null}
      title={title}
      description={description}
      stayLabel={stayLabel}
      leaveLabel={leaveLabel}
      saveLabel={onSave ? saveLabel : undefined}
      onStay={() => setLeaveTo(null)}
      onLeave={() => {
        const to = leaveTo!;
        activeRef.current = false;
        setLeaveTo(null);
        router.push(to);
      }}
      onSave={() => {
        setLeaveTo(null);
        onSave?.();
      }}
    />
  );
}

// The pop-up itself; also used by dialogs with unsaved changes. Buttons stack
// full-width so they always fit inside the window.
export function ConfirmLeaveDialog({
  open,
  title,
  description,
  stayLabel,
  leaveLabel,
  saveLabel,
  onStay,
  onLeave,
  onSave,
}: {
  open: boolean;
  title: string;
  description: string;
  stayLabel: string;
  leaveLabel: string;
  saveLabel?: string;
  onStay: () => void;
  onLeave: () => void;
  onSave?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onStay()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {saveLabel && onSave && (
            <Button className="w-full" onClick={onSave}>
              {saveLabel}
            </Button>
          )}
          <Button variant="outline" className="w-full" onClick={onStay}>
            {stayLabel}
          </Button>
          <Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={onLeave}>
            {leaveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
