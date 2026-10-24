"use client";

import { MenuIcon, XIcon } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

// Phones and tablets (owner, Oct 24): the left menu is hidden on narrow
// screens, so a ☰ button in the top bar opens the same menu, sliding in from
// the left. Picking a page, tapping outside or pressing Escape closes it.
export function MobileMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [at, setAt] = useState(`${pathname}?${search}`);
  // Close after moving to another page or view.
  if (`${pathname}?${search}` !== at) {
    setAt(`${pathname}?${search}`);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    // Keep the page behind from scrolling while the menu is open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  // The panel is drawn at the end of the page, not inside the top bar: the
  // bar's blur effect would otherwise squeeze it to the bar's height.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="-ml-1 flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <MenuIcon className="size-5" />
      </button>
      {mounted &&
        createPortal(
          <div className="md:hidden">
            <div
              className={cn(
                "fixed inset-0 z-50 bg-black/40 transition-opacity",
                open ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <aside
              aria-label="Marketing team menu"
              aria-hidden={!open}
              inert={!open}
              className={cn(
                "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-2 overflow-y-auto border-r bg-background p-4 shadow-xl transition-transform duration-200",
                "pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]",
                open ? "translate-x-0" : "-translate-x-full",
              )}
            >
              <div className="flex items-center justify-between pb-2 pl-3">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Marketing team
                </p>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <XIcon className="size-4" />
                </button>
              </div>
              <nav aria-label="Marketing team" className="space-y-1">
                {children}
              </nav>
            </aside>
          </div>,
          document.body,
        )}
    </div>
  );
}
