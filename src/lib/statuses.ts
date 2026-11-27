import type { Enums } from "@/lib/supabase/database.types";

export type RequestStatus = Enums<"request_status">;

// Single source of truth for status labels and colours (CLAUDE.md §4.2).
// Use these everywhere: tables, filters, details pages and emails.
// `requesterLabel` is what requesters see when it differs.
export const STATUSES: { value: RequestStatus; label: string; requesterLabel?: string; badge: string }[] = [
  { value: "new_request", label: "New request", badge: "bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300" },
  {
    value: "designer_assigned",
    label: "Designer assigned (not yet started)",
    badge: "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300",
  },
  {
    value: "in_progress",
    label: "In progress",
    badge: "bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300",
  },
  // Three review rounds (owner, Nov 26): the old "For requester's review"
  // is the 1st draft. V3 is the last round.
  {
    value: "for_review",
    label: "For review – 1st draft",
    badge: "bg-violet-100 dark:bg-violet-500/20 text-violet-800 dark:text-violet-300",
  },
  {
    value: "for_review_v2",
    label: "For review – V2",
    badge: "bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300",
  },
  {
    value: "for_review_v3",
    label: "For review – V3",
    badge: "bg-fuchsia-100 dark:bg-fuchsia-500/20 text-fuchsia-800 dark:text-fuchsia-300",
  },
  {
    value: "for_revision",
    label: "For revision",
    badge: "bg-orange-100 dark:bg-orange-500/20 text-orange-900 dark:text-orange-300",
  },
  {
    value: "completed",
    label: "Completed",
    badge: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300",
  },
  // Stored as "rejected" in the database; shown as "Returned" to everyone (Oct 17).
  { value: "rejected", label: "Returned", badge: "bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300" },
  { value: "cancelled", label: "Cancelled", badge: "bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300" },
  { value: "on_hold", label: "On hold", badge: "bg-slate-200 text-slate-700" },
];

const byValue = new Map(STATUSES.map((s) => [s.value, s]));

// Cancelled and Returned requests leave the pipeline for the Inactive
// Requests page (owner, Oct 20).
export const INACTIVE_STATUSES = ["rejected", "cancelled"] as const;

// The three review rounds, in order (owner, Nov 26).
export const REVIEW_STATUSES = ["for_review", "for_review_v2", "for_review_v3"] as const;

// Which review round a status is (1–3), or null.
export function reviewStage(status: string): number | null {
  const i = (REVIEW_STATUSES as readonly string[]).indexOf(status);
  return i < 0 ? null : i + 1;
}

// Accepted work that's still open: Designer assigned → For revision.
export const OPEN_WORK_STATUSES = [
  "designer_assigned",
  "in_progress",
  ...REVIEW_STATUSES,
  "for_revision",
] as const satisfies readonly RequestStatus[];

// The Pendings tabs (§7.2 #5), in order. For Review holds all three review
// rounds; `status` is the tab's key in the URL.
export const PENDING_TABS: { status: RequestStatus; statuses: readonly RequestStatus[]; label: string }[] = [
  { status: "new_request", statuses: ["new_request"], label: "New Requests" },
  { status: "designer_assigned", statuses: ["designer_assigned"], label: "Not Started" },
  { status: "in_progress", statuses: ["in_progress"], label: "In Progress" },
  { status: "for_review", statuses: REVIEW_STATUSES, label: "For Review" },
  { status: "for_revision", statuses: ["for_revision"], label: "For Revision" },
];

// Every status on the Pendings page.
export const PENDING_STATUSES: RequestStatus[] = PENDING_TABS.flatMap((t) => t.statuses);

// The Pendings tab a status belongs to (its key).
export function pendingTabOf(status: string): RequestStatus | null {
  return PENDING_TABS.find((t) => (t.statuses as readonly string[]).includes(status))?.status ?? null;
}

// Reached Designer assigned or later: "Accepted" on the Dashboard and the
// Completed Requests page (the rate's basis).
export const ACCEPTED_STATUSES = [...OPEN_WORK_STATUSES, "completed"] as const;

// Statuses that need an assigned designer first (owner, Oct 18; the
// database enforces this too).
export const NEEDS_DESIGNER = new Set<RequestStatus>(["in_progress", ...REVIEW_STATUSES, "for_revision", "completed"]);

// Statuses that need a Link to Output (the database checks too).
export const LINK_REQUIRED = new Set<string>([...REVIEW_STATUSES, "for_revision", "completed"]);

// Why a review round can't be picked yet (owner, Nov 26): rounds go in
// order, V3 is the last (after it only Completed, On hold or Cancelled), and
// going back to an earlier round is a correction for Super Admins, Lead
// Designers and the request's own designers (owner, Nov 27). `round` = the
// request's latest review round (0–3). The database checks the same
// (0049_first_draft_and_rounds.sql, 0050_designers_correct_rounds.sql).
export function reviewLock(status: string, round: number, canCorrect: boolean): string | null {
  const stage = reviewStage(status);
  if (stage !== null) {
    if (stage > round + 1) return stage === 2 ? "send the 1st draft first" : "send V2 first";
    if (stage < round && !canCorrect) return "already past this round";
    return null;
  }
  if (round >= 3 && (status === "in_progress" || status === "for_revision")) return "V3 is the last round";
  return null;
}

// The same colours as hex, for emails (email programs ignore the app's CSS).
const EMAIL_COLORS: Record<RequestStatus, { bg: string; text: string }> = {
  new_request: { bg: "#e0f2fe", text: "#075985" },
  designer_assigned: { bg: "#e0e7ff", text: "#3730a3" },
  in_progress: { bg: "#fef3c7", text: "#78350f" },
  for_review: { bg: "#ede9fe", text: "#5b21b6" },
  for_review_v2: { bg: "#f3e8ff", text: "#6b21a8" },
  for_review_v3: { bg: "#fae8ff", text: "#86198f" },
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
  return STATUSES.map((s) => ({
    value: s.value,
    label: audience === "requester" ? (s.requesterLabel ?? s.label) : s.label,
  }));
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
// don't change a request's status at all, On hold and Cancel included (owner,
// Nov 20; was On hold / Cancel only since Oct 30), and can't change designers.
// The database checks too (0043_admins_no_status.sql).
export type DesignerViewer = { designerId: string | null; isManager: boolean; isAdmin: boolean };
export function adminOnly(viewer: DesignerViewer) {
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
export function designerAccess(status: string, designerIds: readonly string[], viewer: DesignerViewer) {
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
