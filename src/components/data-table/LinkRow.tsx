"use client";

import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";

// A table row that opens `href` when clicked anywhere (owner, Oct 22), except
// on the row's own links, buttons, dropdowns and pop-ups. Shows a light
// brand-blue tint on hover.
export function LinkRow({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  function open(e: React.MouseEvent<HTMLTableRowElement>) {
    const target = e.target as HTMLElement;
    // Pop-ups (dropdown lists, link editor) live outside the row on the page
    // but still pass their clicks up to it, so only clicks inside count.
    if (!e.currentTarget.contains(target)) return;
    if (target.closest("a, button, input, select, textarea, label, [role=combobox], [role=menu], [role=dialog]")) return;
    if (window.getSelection()?.toString()) return; // selecting text, not opening
    if (e.metaKey || e.ctrlKey) window.open(href, "_blank");
    else router.push(href);
  }
  return (
    <TableRow onClick={open} className="cursor-pointer hover:bg-brand-soft">
      {children}
    </TableRow>
  );
}
