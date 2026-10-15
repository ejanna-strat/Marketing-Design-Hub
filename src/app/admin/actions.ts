"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { Constants } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

const patchSchema = z
  .object({
    status: z.enum(Constants.public.Enums.request_status),
    assigned_designer_id: z.uuid().nullable(),
    link_to_output: z
      .string()
      .trim()
      .max(2000, "Please keep the link under 2,000 characters.")
      .transform((v) => v || null)
      .nullable(),
    date_needed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a valid date."),
  })
  .partial()
  .strict();

export type RequestPatch = z.input<typeof patchSchema>;

const DESIGNER_FIELDS = new Set(["status", "link_to_output"]);

// Changes pipeline fields on one request. Admins can change Status, Designer,
// Link to Output and Date Needed; designers only Status and Link to Output.
// The database enforces the same rules (RLS + column guard) and writes the
// activity log.
export async function updateRequest(requestId: string, patch: RequestPatch): Promise<Result> {
  const user = await getCurrentUser();
  if (!user?.isStaff) return { ok: false, error: "Only the Marketing team can change requests." };
  if (!z.uuid().safeParse(requestId).success) return { ok: false, error: "Request not found." };

  const parsed = patchSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your changes." };
  const changes = parsed.data;
  const fields = Object.keys(changes);
  if (fields.length === 0) return { ok: true };
  if (!user.isAdmin && fields.some((f) => !DESIGNER_FIELDS.has(f))) {
    return { ok: false, error: "Designers can only change Status and Link to Output." };
  }

  const supabase = await createClient();
  const { data: before } = await supabase.from("requests").select("status").eq("id", requestId).maybeSingle();
  if (!before) return { ok: false, error: "Request not found." };

  const { data, error } = await supabase
    .from("requests")
    .update(changes)
    .eq("id", requestId)
    .select("id, request_code, status")
    .maybeSingle();
  if (error) {
    console.error("updateRequest failed", error);
    return { ok: false, error: error.code === "42501" ? error.message : "We couldn't save the change. Please try again." };
  }
  if (!data) return { ok: false, error: "You can't change this request." };

  revalidatePath("/admin/pipeline");
  revalidatePath(`/admin/requests/${data.request_code}`);
  return { ok: true };
}
