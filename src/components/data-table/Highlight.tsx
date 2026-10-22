"use client";

import { useSearchParams } from "next/navigation";

// Marks the words that matched the search box (?q=…), so it's clear why a
// row is in the results (owner, Oct 20).
export function Highlight({ text }: { text: string | null | undefined }) {
  const q = useSearchParams().get("q")?.trim();
  if (!text) return null;
  if (!q) return <>{text}</>;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-amber-200 dark:bg-amber-500/40 px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
