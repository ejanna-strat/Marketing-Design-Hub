"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getAppUrl } from "@/lib/app-url";
import { requireUser } from "@/lib/auth";
import { notifyCancelled } from "@/lib/email/notifications";
import { createClient } from "@/lib/supabase/server";

// The requester cancels their own request with a reason (owner, Oct 21).
// cancel_my_request() checks it's theirs and not Completed / Cancelled /
// Returned. The assigned designer, if any, gets an email.
export async function cancelMyRequest(requestId: string, reason: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser();
  if (!z.uuid().safeParse(requestId).success) return { ok: false, error: "Request not found." };
  const text = reason.trim();
  if (!text) return { ok: false, error: "Please give the reason for cancelling the request." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_my_request", { p_request_id: requestId, p_reason: text });
  if (error) {
    console.error("cancel_my_request failed", error);
    return { ok: false, error: error.code === "P0001" || error.code === "42501" ? error.message : "We couldn't cancel the request. Please try again." };
  }
  const result = data as { request_code: string; had_designer: boolean };
  if (result.had_designer) {
    const appUrl = await getAppUrl();
    after(() => notifyCancelled(requestId, appUrl));
  }
  revalidatePath(`/my-requests/${result.request_code}`);
  revalidatePath("/my-requests");
  revalidatePath("/admin", "layout");
  return { ok: true };
}
