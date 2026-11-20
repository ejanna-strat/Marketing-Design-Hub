"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAX_IN_BANNER, PRIORITIES } from "@/lib/announcements";
import { getCurrentUser } from "@/lib/auth";
import { todayInManila } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

const NOT_ALLOWED = "You can't post announcements. Please ask a Super Admin.";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// "name@stratpoint.com" → mailto:, "example.com" → https://.
function normalizeUrl(raw: string) {
  const v = raw.trim();
  if (!v) return "";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  if (/^(https:\/\/|mailto:)/i.test(v)) return v;
  if (/^http:\/\//i.test(v)) return v.replace(/^http:/i, "https:");
  return `https://${v}`;
}

const announcementSchema = z
  .object({
    id: z.string().uuid().optional(),
    headline: z
      .string()
      .trim()
      .min(1, "Please enter the headline.")
      .max(80, "Please keep the headline under 80 characters."),
    message: z.string().trim().max(240, "Please keep the message under 240 characters."),
    linkLabel: z.string().trim().max(30, "Please keep the button text under 30 characters."),
    // The button opens a link, or a longer message in a pop-up (owner, Nov 20).
    buttonAction: z.enum(["link", "details"]),
    linkUrl: z.string().trim().max(2000).transform(normalizeUrl),
    details: z.string().trim().max(5000, "Please keep the longer message under 5,000 characters."),
    priority: z.enum(PRIORITIES),
    inBanner: z.boolean(),
    startsOn: z.string().regex(DATE, "Please pick a start date."),
    endsOn: z.string().regex(DATE).nullable(),
  })
  .refine((a) => !a.endsOn || a.endsOn >= a.startsOn, { message: "The end date can't be before the start date." })
  .transform((a) => ({
    ...a,
    linkUrl: a.linkLabel && a.buttonAction === "link" ? a.linkUrl : "",
    details: a.linkLabel && a.buttonAction === "details" ? a.details : "",
  }))
  .refine((a) => !a.linkLabel || a.linkUrl || a.details, {
    message: "Please add what the button opens: a link, or the longer message.",
  })
  .refine((a) => a.linkLabel || (!a.linkUrl && !a.details), {
    message: "Please enter the button text.",
  })
  .refine((a) => !a.linkUrl || /^(https:\/\/[^\s]+\.[^\s]+|mailto:[^\s@]+@[^\s@]+)$/i.test(a.linkUrl), {
    message: "Please enter a web address (https://…) or an email address for the button.",
  });

export type AnnouncementInput = z.input<typeof announcementSchema>;

function failed(error: { message: string }): Result {
  console.error("announcement update failed", error);
  return { ok: false, error: "We couldn't save the change. Please try again." };
}

function refresh() {
  revalidatePath("/settings/announcements");
  revalidatePath("/hubs");
}

// Adds an announcement, or saves changes to one.
export async function saveAnnouncement(input: AnnouncementInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user?.canPostAnnouncements) return { ok: false, error: NOT_ALLOWED };

  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const a = parsed.data;
  const supabase = await createClient();

  // Up to 3 banners that are live or scheduled (owner, Nov 20).
  const today = todayInManila();
  if (a.inBanner && !(a.endsOn && a.endsOn < today)) {
    let query = supabase
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .eq("in_banner", true)
      .or(`ends_on.is.null,ends_on.gte.${today}`);
    if (a.id) query = query.neq("id", a.id);
    const { count, error } = await query;
    if (error) return failed(error);
    if ((count ?? 0) >= MAX_IN_BANNER) {
      return {
        ok: false,
        error: `The top banner already has ${MAX_IN_BANNER} announcements (live or scheduled). Untick "Show in the top banner", or take one of the others out of the banner first.`,
      };
    }
  }

  const row = {
    headline: a.headline,
    message: a.message,
    link_label: a.linkLabel || null,
    link_url: a.linkUrl || null,
    details: a.details || null,
    priority: a.priority,
    in_banner: a.inBanner,
    starts_on: a.startsOn,
    ends_on: a.endsOn,
  };
  const { error } = a.id
    ? await supabase
        .from("announcements")
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq("id", a.id)
    : await supabase.from("announcements").insert({ ...row, created_by: user.id });
  if (error) return failed(error);

  refresh();
  return { ok: true };
}

export async function deleteAnnouncement(id: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user?.canPostAnnouncements) return { ok: false, error: NOT_ALLOWED };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Please try again." };

  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) return failed(error);

  refresh();
  return { ok: true };
}

// Ticks or unticks a team member as someone who can post. Super Admins only.
export async function setPoster(userId: string, canPost: boolean): Promise<Result> {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) return { ok: false, error: "Only Super Admins can choose who posts announcements." };
  if (!z.string().uuid().safeParse(userId).success) return { ok: false, error: "Please try again." };

  const supabase = await createClient();
  const { error } = canPost
    ? await supabase
        .from("announcement_posters")
        .upsert({ user_id: userId, added_by: user.id }, { onConflict: "user_id", ignoreDuplicates: true })
    : await supabase.from("announcement_posters").delete().eq("user_id", userId);
  if (error) return failed(error);

  // Who sees Settings and the panel's Add button changes everywhere.
  revalidatePath("/", "layout");
  return { ok: true };
}
