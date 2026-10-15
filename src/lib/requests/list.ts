import "server-only";
import { addDays, format, parseISO } from "date-fns";
import { manilaDayStart } from "@/lib/dates";
import { isStatus } from "@/lib/statuses";
import type { createClient } from "@/lib/supabase/server";

// Server-side paging, sorting and filtering for the request tables, driven by
// the page's URL search params (so filters survive reloads and can be shared).

export const PAGE_SIZE = 25;

// Columns that can be sorted. Each is a column on `requests`.
export const SORTABLE_COLUMNS = [
  "request_code",
  "created_at",
  "date_needed",
  "title",
  "output_needed",
  "status",
  "requester_name",
  "requester_email",
] as const;
type SortColumn = (typeof SORTABLE_COLUMNS)[number];

export type ListParams = {
  q: string;
  status: string;
  type: string;
  designer: string; // a designer id, or "none" for unassigned
  team: string;
  from: string;
  to: string;
  sort: SortColumn;
  dir: "asc" | "desc";
  page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function one(sp: SearchParams, key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

export function parseListParams(sp: SearchParams): ListParams {
  const sort = one(sp, "sort");
  const page = Number.parseInt(one(sp, "page"), 10);
  const designer = one(sp, "designer");
  return {
    q: one(sp, "q").slice(0, 100),
    status: isStatus(one(sp, "status")) ? one(sp, "status") : "",
    type: UUID.test(one(sp, "type")) ? one(sp, "type") : "",
    designer: designer === "none" || UUID.test(designer) ? designer : "",
    team: UUID.test(one(sp, "team")) ? one(sp, "team") : "",
    from: DAY.test(one(sp, "from")) ? one(sp, "from") : "",
    to: DAY.test(one(sp, "to")) ? one(sp, "to") : "",
    sort: (SORTABLE_COLUMNS as readonly string[]).includes(sort) ? (sort as SortColumn) : "created_at",
    dir: one(sp, "dir") === "asc" ? "asc" : "desc",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

const LIST_COLUMNS = `
  id, request_code, created_at, date_needed, title, output_needed, status, link_to_output,
  requester_name, requester_email, assigned_designer_id,
  request_type:request_types(name), team:teams(name), designer:designers(display_name)
`;

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function listRequests(
  supabase: Supabase,
  params: ListParams,
  options: { requesterId?: string; searchRequester?: boolean } = {},
) {
  let query = supabase.from("requests").select(LIST_COLUMNS, { count: "exact" });

  if (options.requesterId) query = query.eq("requester_id", options.requesterId);

  // Characters that would break PostgREST's or() syntax are dropped.
  const term = params.q.replace(/[,()*%\\"':]/g, " ").trim();
  if (term) {
    const fields = ["request_code", "title"];
    if (options.searchRequester) fields.push("requester_name", "requester_email");
    query = query.or(fields.map((f) => `${f}.ilike.*${term}*`).join(","));
  }
  if (params.status) query = query.eq("status", params.status as never);
  if (params.type) query = query.eq("request_type_id", params.type);
  if (params.team) query = query.eq("team_id", params.team);
  if (params.designer === "none") query = query.is("assigned_designer_id", null);
  else if (params.designer) query = query.eq("assigned_designer_id", params.designer);
  // Date range on the request date, in Manila days (both ends included).
  if (params.from) query = query.gte("created_at", manilaDayStart(params.from));
  if (params.to) query = query.lt("created_at", manilaDayStart(format(addDays(parseISO(params.to), 1), "yyyy-MM-dd")));

  query = query.order(params.sort, { ascending: params.dir === "asc" });
  if (params.sort !== "created_at") query = query.order("created_at", { ascending: false });

  const start = (params.page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(start, start + PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return { rows: data ?? [], total: count ?? 0 };
}

export type RequestListRow = Awaited<ReturnType<typeof listRequests>>["rows"][number];
