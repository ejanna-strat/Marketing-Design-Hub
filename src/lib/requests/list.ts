import "server-only";
import { addDays, format, parseISO } from "date-fns";
import { manilaDayStart } from "@/lib/dates";
import { INACTIVE_STATUSES, isStatus } from "@/lib/statuses";
import type { createClient } from "@/lib/supabase/server";

// Server-side paging, sorting and filtering for the request tables, driven by
// the page's URL search params (so filters survive reloads and can be shared).
// Multi-choice filters are comma-separated (?status=in_progress,for_review).

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

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
  "deal_name",
  "deal_size",
] as const;
type SortColumn = (typeof SORTABLE_COLUMNS)[number];

// Pipeline views (owner, Oct 20): open work by default. On hold requests
// have their own view and are not in Open (owner, Oct 21).
// My Requests also has Inactive (Cancelled + Returned).
export type View = "open" | "on_hold" | "completed" | "inactive" | "all";

export type ListParams = {
  q: string;
  status: string[];
  type: string[];
  team: string[];
  designer: string; // a designer id, or "none" for unassigned
  from: string;
  to: string;
  view: View;
  deal: "" | "yes" | "no"; // Deal Associated filter
  sort: SortColumn;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function one(sp: SearchParams, key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

function many(sp: SearchParams, key: string, valid: (v: string) => boolean): string[] {
  return [...new Set(one(sp, key).split(",").map((v) => v.trim()).filter(valid))];
}

export function parseListParams(sp: SearchParams): ListParams {
  const sort = one(sp, "sort");
  const page = Number.parseInt(one(sp, "page"), 10);
  const size = Number.parseInt(one(sp, "size"), 10);
  const designer = one(sp, "designer");
  const view = one(sp, "view");
  return {
    q: one(sp, "q").slice(0, 100),
    status: many(sp, "status", isStatus),
    type: many(sp, "type", (v) => UUID.test(v)),
    team: many(sp, "team", (v) => UUID.test(v)),
    designer: designer === "none" || UUID.test(designer) ? designer : "",
    from: DAY.test(one(sp, "from")) ? one(sp, "from") : "",
    to: DAY.test(one(sp, "to")) ? one(sp, "to") : "",
    view: view === "on_hold" || view === "completed" || view === "inactive" || view === "all" ? view : "open",
    deal: one(sp, "deal") === "yes" || one(sp, "deal") === "no" ? (one(sp, "deal") as "yes" | "no") : "",
    sort: (SORTABLE_COLUMNS as readonly string[]).includes(sort) ? (sort as SortColumn) : "created_at",
    dir: one(sp, "dir") === "asc" ? "asc" : "desc",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
  };
}

const LIST_COLUMNS = `
  id, request_code, created_at, date_needed, title, output_needed, status, link_to_output,
  requester_name, requester_email, assigned_designer_id, designer_response, reassign_reason,
  is_deal, deal_name, deal_size, return_reason, cancel_reason, updated_at,
  request_type:request_types(name), team:teams(name), designer:designers(display_name),
  feedback(process_rating, output_rating)
`;

type Supabase = Awaited<ReturnType<typeof createClient>>;


type ListOptions = {
  requesterId?: string;
  searchRequester?: boolean;
  // "pipeline": active requests only, with the Open / Completed / All view.
  // "inactive": Cancelled and Returned only. "requester": My Requests, with
  // the Open / On Hold / Completed / Inactive / All view. Default: everything.
  scope?: "pipeline" | "inactive" | "requester";
  dealsOnly?: boolean;
};

// The filter methods used below, shared by every requests query.
type Filterable = {
  eq(column: string, value: unknown): Filterable;
  neq(column: string, value: unknown): Filterable;
  not(column: string, operator: string, value: unknown): Filterable;
  in(column: string, values: readonly unknown[]): Filterable;
  or(filters: string): Filterable;
  is(column: string, value: null): Filterable;
  gte(column: string, value: unknown): Filterable;
  lt(column: string, value: unknown): Filterable;
};

// The search box as one or() condition. Also matches Type of Request, Output
// Needed and the assigned designer (owner, Oct 18); type and designer names
// live in other tables, so their ids are looked up first.
async function searchCondition(supabase: Supabase, params: ListParams, options: ListOptions) {
  // Characters that would break PostgREST's or() syntax are dropped.
  const term = params.q.replace(/[,()*%\\"':]/g, " ").trim();
  if (!term) return null;
  const [types, designers] = await Promise.all([
    supabase.from("request_types").select("id").ilike("name", `%${term}%`),
    supabase.from("designers").select("id").ilike("display_name", `%${term}%`),
  ]);
  const fields = ["request_code", "title", "output_needed"];
  if (options.searchRequester) fields.push("requester_name", "requester_email");
  if (options.dealsOnly) fields.push("deal_name");
  const conditions = fields.map((f) => `${f}.ilike.*${term}*`);
  const typeIds = (types.data ?? []).map((t) => t.id);
  const designerIds = (designers.data ?? []).map((d) => d.id);
  if (typeIds.length) conditions.push(`request_type_id.in.(${typeIds.join(",")})`);
  if (designerIds.length) conditions.push(`assigned_designer_id.in.(${designerIds.join(",")})`);
  return conditions.join(",");
}

// Applies every filter in the URL (except Status when `skipStatus`).
function applyFilters<Q>(base: Q, params: ListParams, options: ListOptions, search: string | null, skipStatus = false): Q {
  let query = base as unknown as Filterable;
  if (options.requesterId) query = query.eq("requester_id", options.requesterId);
  if (options.dealsOnly) query = query.eq("is_deal", true);
  if (options.scope === "pipeline") {
    query = query.not("status", "in", `(${INACTIVE_STATUSES.join(",")})`);
    if (params.view === "open") query = query.not("status", "in", "(completed,on_hold)");
    if (params.view === "on_hold") query = query.eq("status", "on_hold");
    if (params.view === "completed") query = query.eq("status", "completed");
  }
  if (options.scope === "inactive") query = query.in("status", INACTIVE_STATUSES);
  if (options.scope === "requester") {
    if (params.view === "open") query = query.not("status", "in", `(completed,on_hold,${INACTIVE_STATUSES.join(",")})`);
    if (params.view === "on_hold") query = query.eq("status", "on_hold");
    if (params.view === "completed") query = query.eq("status", "completed");
    if (params.view === "inactive") query = query.in("status", INACTIVE_STATUSES);
  }
  if (params.deal) query = query.eq("is_deal", params.deal === "yes");
  if (search) query = query.or(search);
  if (!skipStatus && params.status.length) query = query.in("status", params.status);
  if (params.type.length) query = query.in("request_type_id", params.type);
  if (params.team.length) query = query.in("team_id", params.team);
  if (params.designer === "none") query = query.is("assigned_designer_id", null);
  else if (params.designer) query = query.eq("assigned_designer_id", params.designer);
  // Date range on the request date, in Manila days (both ends included).
  if (params.from) query = query.gte("created_at", manilaDayStart(params.from));
  if (params.to) query = query.lt("created_at", manilaDayStart(format(addDays(parseISO(params.to), 1), "yyyy-MM-dd")));
  return query as unknown as Q;
}

export async function listRequests(supabase: Supabase, params: ListParams, options: ListOptions = {}) {
  const search = await searchCondition(supabase, params, options);
  let query = applyFilters(supabase.from("requests").select(LIST_COLUMNS, { count: "exact" }), params, options, search);
  query = query.order(params.sort, { ascending: params.dir === "asc", nullsFirst: false });
  if (params.sort !== "created_at") query = query.order("created_at", { ascending: false });

  const start = (params.page - 1) * params.pageSize;
  const { data, count, error } = await query.range(start, start + params.pageSize - 1);
  if (error) throw new Error(error.message);
  return { rows: data ?? [], total: count ?? 0 };
}

// The statuses present under the current tab, view and filters (ignoring the
// Status filter itself), so the Status filter can grey out the rest
// (owner, Oct 21).
export async function statusesInView(supabase: Supabase, params: ListParams, options: ListOptions = {}) {
  const search = await searchCondition(supabase, params, options);
  const { data, error } = await applyFilters(supabase.from("requests").select("status"), params, options, search, true);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.status as string));
}

export type RequestListRow = Awaited<ReturnType<typeof listRequests>>["rows"][number];
