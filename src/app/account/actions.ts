"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { isTheme } from "@/lib/theme/shared";
import { createClient } from "@/lib/supabase/server";

// Changes the signed-in person's display name. New requests use it; requests
// already filed keep the name they were filed with. The email can't change.
export async function updateMyName(rawName: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Please enter your name." };
  if (name.length > 100) return { ok: false, error: "Please keep your name under 100 characters." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
  if (error) {
    console.error("updateMyName failed", error);
    return { ok: false, error: "We couldn't save your name. Please try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// Saves the signed-in person's appearance choice (owner, Oct 22). The page
// switches straight away on their side; this keeps it for their next visit
// and other devices.
export async function updateMyTheme(theme: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  if (!isTheme(theme)) return { ok: false, error: "Please choose Light, Dark or System." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ theme }).eq("id", user.id);
  if (error) {
    console.error("updateMyTheme failed", error);
    return { ok: false, error: "We couldn't save your appearance setting. Please try again." };
  }
  return { ok: true };
}
