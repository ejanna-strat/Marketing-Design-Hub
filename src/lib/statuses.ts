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
  // Stored as "rejected" in the database; shown as "Returned" to everyone (Oct 17).
  { value: "rejected", label: "Returned", badge: "bg-red-100 text-red-800" },
  { value: "cancelled", label: "Cancelled", badge: "bg-red-100 text-red-800" },
  { value: "on_hold", label: "On hold", badge: "bg-slate-200 text-slate-700" },
];

const byValue = new Map(STATUSES.map((s) => [s.value, s]));

// Cancelled and Returned requests leave the pipeline for the Inactive
// Requests page (owner, Oct 20).
export const INACTIVE_STATUSES = ["rejected", "cancelled"] as const;

// The Pendings tabs (§7.2 #5), in order.
export const PENDING_TABS: { status: RequestStatus; label: string }[] = [
  { status: "new_request", label: "New Requests" },
  { status: "designer_assigned", label: "Not Started" },
  { status: "in_progress", label: "In Progress" },
  { status: "for_review", label: "For Review" },
  { status: "for_revision", label: "For Revision" },
];

// Statuses that need an assigned designer first (owner, Oct 18; the
// database enforces this too).
export const NEEDS_DESIGNER = new Set<RequestStatus>(["in_progress", "for_review", "for_revision", "completed"]);

// The same colours as hex, for emails (email programs ignore the app's CSS).
const EMAIL_COLORS: Record<RequestStatus, { bg: string; text: string }> = {
  new_request: { bg: "#e0f2fe", text: "#075985" },
  designer_assigned: { bg: "#e0e7ff", text: "#3730a3" },
  in_progress: { bg: "#fef3c7", text: "#78350f" },
  for_review: { bg: "#ede9fe", text: "#5b21b6" },
  for_revision: { bg: "#ffedd5", text: "#7c2d12" },
  completed: { bg: "#d1fae5", text: "#065f46" },
  rejected: { bg: "#fee2e2", text: "#991b1b" },
  cancelled: { bg: "#fee2e2", text: "#991b1b" },
  on_hold: { bg: "#e2e8f0", text: "#334155" },
};

export function statusEmailColors(status: string) {
  return EMAIL_COLORS[status as RequestStatus] ?? { bg: "#e2e8f0", text: "#334155" };
}

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
