import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/app-url";
import { createClient } from "@/lib/supabase/server";

// Every email link lands here (see docs/supabase-auth-setup.md):
//   ?token_hash=…&type=signup     confirm a new account → sign in page
//   ?token_hash=…&type=recovery   reset password        → set a new password
//   ?token_hash=…&type=email|magiclink                  → home
//   ?code=…                       Supabase's default {{ .ConfirmationURL }}
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }

  const url = request.nextUrl.clone();
  url.search = "";
  if (!ok) {
    url.pathname = "/login";
    url.searchParams.set("error", "link");
  } else if (type === "recovery") {
    url.pathname = "/reset-password";
  } else if (type === "signup") {
    // Confirming the email also signs them in, so go straight in.
    url.pathname = "/";
  } else {
    url.pathname = safeNextPath(searchParams.get("next"));
  }
  return NextResponse.redirect(url);
}
