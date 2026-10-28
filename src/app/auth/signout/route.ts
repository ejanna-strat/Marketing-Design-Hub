import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACTIVE_COOKIE, OPEN_COOKIE } from "@/lib/idle";
import { createClient } from "@/lib/supabase/server";

// Auto sign-out (src/lib/idle.ts): IdleSignOut calls this when time is up,
// then opens /login. Signing out first means the session is gone even if an
// unsaved form keeps the page open.
export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_COOKIE);
  cookieStore.delete(OPEN_COOKIE);
  return new NextResponse(null, { status: 204 });
}
