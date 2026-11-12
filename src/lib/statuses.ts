import type { Enums } from "@/lib/supabase/database.types";

export type RequestStatus = Enums<"request_status">;

// Single source of truth for status labels and colours (CLAUDE.md §4.2).
// Use these everywhere: tables, filters, details pages and emails.
// `requesterLabel` is what requesters see when it differs.
export const STATUSES: { value: RequestStatus; label: string; requesterLabel?: string; badge: string }[] = [
  { value: "new_request", label: "New request", badge: "bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300" },
  { value: "designer_assigned", label: "Designer assigned (not yet started)", badge: "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300" },
  { value: "in_progress", label: "In progress", badge: "bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300" },
  { value: "for_review", label: "For requester's review", badge: "bg-violet-100 dark:bg-violet-500/20 text-violet-800 dark:text-violet-300" },
  { value: "for_revision", label: "For revision", badge: "bg-orange-100 dark:bg-orange-500/20 text-orange-900 dark:text-orange-300" },
  { value: "completed", label: "Completed", badge: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300" },
  // Stored as "rejected" in the database; shown as "Returned" to everyone (Oct 17).
  { value: "rejected", label: "Returned", badge: "bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300" },
  { value: "cancelled", label: "Cancelled", badge: "bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300" },
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

// Reached Designer assigned or later: "Accepted" on the Dashboard and the
// Completed Requests page (the rate's basis).
export const ACCEPTED_STATUSES = ["designer_assigned", "in_progress", "for_review", "for_revision", "completed"] as const;

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

// Why the designer / link can't change: Completed keeps its designer, and
// Cancelled or Returned requests are closed (owner, Oct 21).
// New requests get their first designer only through the reviewer's
// Accept & assign (owner, Oct 22).
export function lockedFor(status: string, hasDesigner = true): string | undefined {
  if (status === "new_request" && !hasDesigner) return "Use Accept & assign on the request page to assign a designer";
  if (status === "completed") return "Completed requests keep their designer";
  if (status === "cancelled" || status === "rejected") return "Cancelled and Returned requests can't be changed";
  return undefined;
}

// Status filter options for staff lists. Statuses with no requests in the
// current tab / view are greyed out (owner, Oct 21).
export function statusFilterOptions(include: readonly string[] | null, present: Map<string, number>) {
  return statusOptions()
    .filter((o) => (include ? include.includes(o.value) : !(INACTIVE_STATUSES as readonly string[]).includes(o.value)))
    .map((o) => ({ ...o, count: present.get(o.value) ?? 0, disabled: !present.has(o.value) }));
}

// Admins who aren't in the Designer list (and aren't Leads or Super Admins)
// can only put a request On hold or cancel it, and can't change designers
// (owner, Oct 30). The database checks too (0025_admin_status_limits.sql).
export type DesignerViewer = { designerId: string | null; isManager: boolean; isAdmin: boolean };
export const ADMIN_STATUSES = new Set<string>(["on_hold", "cancelled"]);
export function holdOrCancelOnly(viewer: DesignerViewer) {
  return viewer.isAdmin && !viewer.isManager && !viewer.designerId;
}

// Who can change a request's designers (owner, Nov 12; several designers,
// all equal):
// - Super Admins and Lead Designers add or remove anyone (`canEdit`), except
//   on a fresh New request, whose first designers come from Accept & assign
//   on the request page (owner, Oct 22).
// - Anyone in the Designer list takes a New request with no designer
//   (`canTake`), or adds themselves once it has one (`canAddMe`).
// - Completed, Cancelled and Returned stay locked.
// The database checks the same (0033_multiple_designers.sql).
export function designerAccess(
  status: string,
  designerIds: readonly string[],
  viewer: DesignerViewer,
) {
  const hasDesigners = designerIds.length > 0;
  const closed = lockedFor(status, true);
  const onIt = !!viewer.designerId && designerIds.includes(viewer.designerId);
  return {
    locked: closed ?? (viewer.isManager ? lockedFor(status, hasDesigners) : undefined),
    canEdit: viewer.isManager && !closed && !lockedFor(status, hasDesigners),
    canTake: !!viewer.designerId && status === "new_request" && !hasDesigners,
    canAddMe: !!viewer.designerId && !closed && hasDesigners && !onIt,
  };
}
