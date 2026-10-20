"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const KEY = "mdh:last-list";

// Remembers the list (pipeline tab, filters, page) a request was opened from,
// so the back link returns there (owner, Oct 20). Kept for this browser tab.
export function RememberList({ label }: { label: string }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ href: search ? `${pathname}?${search}` : pathname, label }));
    } catch {
      // Storage blocked: the back link falls back to the pipeline.
    }
  }, [pathname, search, label]);
  return null;
}

export function BackToList({ fallbackHref, fallbackLabel }: { fallbackHref: string; fallbackLabel: string }) {
  const [target, setTarget] = useState({ href: fallbackHref, label: fallbackLabel });
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
      if (saved?.href?.startsWith("/admin")) setTarget(saved);
    } catch {
      // keep the fallback
    }
  }, []);
  return (
    <Link href={target.href} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeftIcon className="size-4" />
      {target.label}
    </Link>
  );
}
