import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ACTIVE_COOKIE, ACTIVE_MAX_AGE, IDLE_LIMIT_MS, OPEN_COOKIE, SIGN_OUT_PATH } from "@/lib/idle";
import type { Database } from "./database.types";

// Pages anyone can open without signing in.
// /api/cron checks its own secret (CRON_SECRET).
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/auth", "/api/cron"];

type Supabase = ReturnType<typeof createServerClient<Database>>;

// Auto sign-out (src/lib/idle.ts): why this browser should be signed out now,
// if at all. The team check only runs when the answer depends on it.
async function idleSignOut(request: NextRequest, supabase: Supabase): Promise<"idle" | "closed" | null> {
  const last = Number(request.cookies.get(ACTIVE_COOKIE)?.value) || 0;
  // Signed in before auto sign-out existed, or just now: nothing to check.
  if (!last) return null;
  const idle = Date.now() - last;
  const reopened = !request.cookies.has(OPEN_COOKIE);
  if (idle >= IDLE_LIMIT_MS.team) return "idle";
  if (idle < IDLE_LIMIT_MS.requester && !reopened) return null;
  const { data: team, error } = await supabase.rpc("is_staff");
  if (error || team) return null;
  return idle >= IDLE_LIMIT_MS.requester ? "idle" : "closed";
}

function setIdleCookies(request: NextRequest, response: NextResponse) {
  const secure = request.nextUrl.protocol === "https:";
  // Links Next.js loads ahead of time aren't activity.
  const prefetch =
    request.headers.has("next-router-prefetch") ||
    request.headers.get("purpose") === "prefetch" ||
    (request.headers.get("sec-purpose") ?? "").includes("prefetch");
  if (!prefetch || !request.cookies.has(ACTIVE_COOKIE)) {
    response.cookies.set(ACTIVE_COOKIE, String(Date.now()), { path: "/", maxAge: ACTIVE_MAX_AGE, sameSite: "lax", secure });
  }
  if (!request.cookies.has(OPEN_COOKIE)) {
    response.cookies.set(OPEN_COOKIE, "1", { path: "/", sameSite: "lax", secure });
  }
}

export function clearIdleCookies(request: NextRequest, response: NextResponse) {
  for (const name of [ACTIVE_COOKIE, OPEN_COOKIE]) {
    if (request.cookies.has(name)) response.cookies.delete(name);
  }
}

// Refreshes the login session on every request, sends signed-out visitors to
// /login and signs out browsers left idle (or reopened, for requesters).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not add code between createServerClient and getClaims(): it refreshes
  // the session cookie. getClaims() checks the session's signature locally
  // (the project signs sessions with public ES256 keys), so most requests
  // don't wait on Supabase at all.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub;

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user) {
    if (!isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      if (path !== "/") url.searchParams.set("next", path + request.nextUrl.search);
      response = NextResponse.redirect(url);
    }
    // A fresh start for the next sign-in.
    clearIdleCookies(request, response);
    return response;
  }

  // Signing out handles its own cookies. Email links (/auth/confirm) sign in
  // afresh, so they start a new idle period instead of being checked.
  if (path === SIGN_OUT_PATH) return response;
  if (!path.startsWith("/auth/") && !path.startsWith("/api/cron")) {
    const reason = await idleSignOut(request, supabase);
    if (reason) {
      await supabase.auth.signOut({ scope: "local" });
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      if (reason === "idle") url.searchParams.set("reason", "idle");
      if (path !== "/" && path !== "/login") url.searchParams.set("next", path + request.nextUrl.search);
      const redirect = NextResponse.redirect(url);
      // signOut() cleared the session cookies on `response`.
      response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      clearIdleCookies(request, redirect);
      return redirect;
    }
  }

  setIdleCookies(request, response);
  return response;
}
