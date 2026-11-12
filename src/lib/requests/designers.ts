// A request's designers (owner, Nov 12): several, all equal, each accepting
// on their own. Stored in `request_designers`; `requests.designer_ids` lists
// them in the order added (0033_multiple_designers.sql). Shared by server
// pages, client tables and emails.

// Embed for a requests select: every designer with their answer.
export const REQUEST_DESIGNERS_SELECT =
  "request_designers(designer_id, response, responded_at, added_at, designer:designers(display_name, email))";

export type RequestDesigner = {
  designer_id: string;
  response: string;
  responded_at: string | null;
  added_at: string;
  designer: { display_name: string; email?: string } | null;
};

// In the order they were added.
export function sortDesigners<T extends { added_at: string }>(rows: T[] | null | undefined): T[] {
  return [...(rows ?? [])].sort((a, b) => a.added_at.localeCompare(b.added_at));
}

export const designerName = (d: RequestDesigner) => d.designer?.display_name ?? "a designer";

// "Sofia, Dasha" (tables, pages).
export function designerNames(rows: RequestDesigner[] | null | undefined): string {
  return sortDesigners(rows).map(designerName).join(", ");
}

// "Sofia", "Sofia and Dasha", "Sofia, Dasha and Jerome" (emails, sentences).
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export const accepted = (rows: RequestDesigner[] | null | undefined) =>
  sortDesigners(rows).filter((d) => d.response === "accepted");
export const pending = (rows: RequestDesigner[] | null | undefined) =>
  sortDesigners(rows).filter((d) => d.response === "pending");

// The viewer's own row on the request, if they're on it.
export function myRow(rows: RequestDesigner[] | null | undefined, designerId: string | null) {
  return designerId ? (rows ?? []).find((d) => d.designer_id === designerId) : undefined;
}
