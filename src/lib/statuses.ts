import type { Enums } from "@/lib/supabase/database.types";

export type RequestStatus = Enums<"request_status">;

// Single source of truth for status labels and colours (CLAUDE.md §4.2).
// Use these everywhere: tables, filters, details pages and emails.
// `requesterLabel` is what requesters see when it differs.
export const STATUSES: { value: RequestStatus; label: string; requesterLabel?: string; badge: string }[] = [
  { value: "new_request", label: "New request", badge: "bg-sky-100 text-sky-800" },
  { value: "designer_assigned", label: "Designer assigned (not yet started)", badge: "bg-indigo-100 text-indigo-800" },
  { value: "in_progress", label: "In progress", badge: "bg-amber-100 text-amber-900" },
  { value: "for_review", label: "For requester's review", badge: "bg-violet-100 text-violet-800" },
  { value: "for_revision", label: "For revision", badge: "bg-orange-100 text-orange-900" },
  { value: "completed", label: "Completed", badge: "bg-emerald-100 text-emerald-800" },
  { value: "rejected", label: "Rejected", requesterLabel: "Returned", badge: "bg-red-100 text-red-800" },
  { value: "cancelled", label: "Cancelled", badge: "bg-zinc-200 text-zinc-700" },
  { value: "on_hold", label: "On hold", badge: "bg-slate-200 text-slate-700" },
];

const byValue = new Map(STATUSES.map((s) => [s.value, s]));

export function isStatus(value: string): value is RequestStatus {
  return byValue.has(value as RequestStatus);
}

export function statusLabel(status: string, audience: "staff" | "requester" = "staff"): string {
  const s = byValue.get(status as RequestStatus);
  if (!s) return status;
  return audience === "requester" ? (s.requesterLabel ?? s.label) : s.label;
}

export function statusBadgeClass(status: string): string {
  return byValue.get(status as RequestStatus)?.badge ?? "bg-muted text-foreground";
}

export function statusOptions(audience: "staff" | "requester" = "staff") {
  return STATUSES.map((s) => ({ value: s.value, label: audience === "requester" ? (s.requesterLabel ?? s.label) : s.label }));
}
