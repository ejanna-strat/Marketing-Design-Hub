"use server";

import { redirect } from "next/navigation";
import { getAppUrl, safeNextPath } from "@/lib/app-url";
import { MIN_PASSWORD, STRATPOINT_EMAIL } from "@/lib/auth-rules";
import { createClient } from "@/lib/supabase/server";

// Email + password sign-in (owner decision, Oct 16). New accounts confirm
// their email once before they can sign in; anyone not on the Marketing team
// list becomes a Requester.

type Result = { ok: true; message?: string } | { ok: false; error: string; unconfirmed?: boolean };

const WRONG_DOMAIN = "Please use your @stratpoint.com email address.";

function cleanEmail(email: string) {
  return email.trim().toLowerCase();
}

function tooMany(error: { status?: number }) {
  return error.status === 429;
}

// Email links (confirm sign-up, reset password) all land on /auth/confirm,
// which sends people on according to the link type.
async function confirmUrl() {
  return `${await getAppUrl()}/auth/confirm`;
}

export async function signIn(rawEmail: string, password: string, next?: string): Promise<Result> {
  const email = cleanEmail(rawEmail);
  if (!STRATPOINT_EMAIL.test(email)) return { ok: false, error: WRONG_DOMAIN };
  if (!password) return { ok: false, error: "Please enter your password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        ok: false,
        unconfirmed: true,
        error: "Please confirm your email first. Click the link in the email we sent when you signed up.",
      };
    }
    if (tooMany(error)) return { ok: false, error: "Too many attempts. Please wait a minute and try again." };
    if (error.code === "invalid_credentials") {
      return {
        ok: false,
        error: "Wrong email or password. If you haven't set a password yet, use Forgot password.",
      };
    }
    console.error("signInWithPassword failed", error);
    return { ok: false, error: "We couldn't sign you in. Please try again." };
  }
  redirect(safeNextPath(next));
}

export async function signUp(input: { fullName: string; email: string; password: string }): Promise<Result> {
  const fullName = input.fullName.trim();
  const email = cleanEmail(input.email);
  if (!fullName) return { ok: false, error: "Please enter your full name." };
  if (!STRATPOINT_EMAIL.test(email)) return { ok: false, error: WRONG_DOMAIN };
  if (input.password.length < MIN_PASSWORD) {
    return { ok: false, error: `Please use at least ${MIN_PASSWORD} characters for your password.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { emailRedirectTo: await confirmUrl(), data: { full_name: fullName } },
  });
  if (error) {
    if (tooMany(error)) return { ok: false, error: "Too many sign-up emails were sent. Please wait a minute and try again." };
    if (error.code === "weak_password") return { ok: false, error: error.message };
    if (error.code === "user_already_exists") {
      return { ok: false, error: "You already have an account. Please sign in, or use Forgot password." };
    }
    if (error.status === 403 || /stratpoint/i.test(error.message)) return { ok: false, error: WRONG_DOMAIN };
    console.error("signUp failed", error);
    return { ok: false, error: "We couldn't create your account. Please try again." };
  }
  // Email confirmation is off in Supabase: they're signed in already.
  if (data.session) redirect("/");
  // Supabase doesn't reveal whether the email already had an account, so
  // the message covers both cases.
  return {
    ok: true,
    message: `We sent a confirmation link to ${email}. Click it to activate your account, then sign in with your password. Already have an account? Sign in, or use Forgot password.`,
  };
}

export async function resendConfirmation(rawEmail: string): Promise<Result> {
  const email = cleanEmail(rawEmail);
  if (!STRATPOINT_EMAIL.test(email)) return { ok: false, error: WRONG_DOMAIN };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: await confirmUrl() } });
  if (error) {
    if (tooMany(error)) return { ok: false, error: "Please wait a minute before asking for another email." };
    console.error("resend failed", error);
    return { ok: false, error: "We couldn't send the email. Please try again." };
  }
  return { ok: true, message: `We sent a new confirmation link to ${email}.` };
}

export async function requestPasswordReset(rawEmail: string): Promise<Result> {
  const email = cleanEmail(rawEmail);
  if (!STRATPOINT_EMAIL.test(email)) return { ok: false, error: WRONG_DOMAIN };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: await confirmUrl() });
  if (error) {
    if (tooMany(error)) return { ok: false, error: "Please wait a minute before asking for another email." };
    console.error("resetPasswordForEmail failed", error);
    return { ok: false, error: "We couldn't send the email. Please try again." };
  }
  return {
    ok: true,
    message: `If ${email} has an account, we sent it a link to set a new password. The link works once.`,
  };
}

// Sets a new password for the signed-in person (after a reset link).
export async function updatePassword(password: string): Promise<Result> {
  if (password.length < MIN_PASSWORD) {
    return { ok: false, error: `Please use at least ${MIN_PASSWORD} characters for your password.` };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "This link has expired. Please ask for a new one." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { ok: false, error: "Please choose a password you haven't used here before." };
    if (error.code === "weak_password") return { ok: false, error: error.message };
    console.error("updateUser failed", error);
    return { ok: false, error: "We couldn't save your password. Please try again." };
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
