"use server";

import { redirect } from "next/navigation";
import { getAppUrl, safeNextPath } from "@/lib/app-url";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

const STRATPOINT_EMAIL = /^[^@\s]+@stratpoint\.com$/;
const WRONG_DOMAIN = "Please use your @stratpoint.com email address.";

function cleanEmail(email: string) {
  return email.trim().toLowerCase();
}

// Sends one email with both a sign-in link and a 6-digit code.
export async function sendLoginEmail(rawEmail: string): Promise<Result> {
  const email = cleanEmail(rawEmail);
  if (!STRATPOINT_EMAIL.test(email)) return { ok: false, error: WRONG_DOMAIN };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${await getAppUrl()}/auth/confirm`,
    },
  });

  if (error) {
    if (error.status === 429) {
      return { ok: false, error: "Too many sign-in emails were sent. Please wait a minute and try again." };
    }
    if (error.status === 403 || /stratpoint/i.test(error.message)) {
      return { ok: false, error: WRONG_DOMAIN };
    }
    console.error("signInWithOtp failed", error);
    return { ok: false, error: "We couldn't send the sign-in email. Please try again." };
  }
  return { ok: true };
}

// Signs in with the 6-digit code from the email.
export async function verifyLoginCode(rawEmail: string, rawCode: string, next?: string): Promise<Result> {
  const email = cleanEmail(rawEmail);
  const token = rawCode.replace(/\s/g, "");
  if (!STRATPOINT_EMAIL.test(email)) return { ok: false, error: WRONG_DOMAIN };
  if (!/^\d{6,8}$/.test(token)) return { ok: false, error: "Please enter the code from the email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    return { ok: false, error: "That code is wrong or has expired. Please check it or send a new email." };
  }
  redirect(safeNextPath(next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
