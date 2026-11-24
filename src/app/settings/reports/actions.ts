"use server";

import { revalidatePath } from "next/cache";
import { firstRequestDay, loadAnalytics } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";
import { serializeAnalytics, yearRange } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; removed: number } | { ok: false; error: string };

// Super Admins: save the year's report, then remove its finished requests
// (archive_year() checks the download, the typed count and the 2-year rule).
export async function archiveYear(year: number, expected: number): Promise<Result> {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) return { ok: false, error: "Only Super Admins can remove archived requests." };
  if (!Number.isInteger(year) || !Number.isInteger(expected) || expected < 1) {
    return { ok: false, error: "Please type the number of requests." };
  }
  const supabase = await createClient();
  const { from, to } = yearRange(year, await firstRequestDay(supabase));
  const report = serializeAnalytics(await loadAnalytics(supabase, from, to, true));
  const { data, error } = await supabase.rpc("archive_year", { p_year: year, p_expected: expected, p_report: report });
  if (error) {
    console.error("archive failed", error);
    return {
      ok: false,
      error:
        error.code === "P0001" || error.code === "42501"
          ? error.message
          : "We couldn't archive the year. Nothing was removed.",
    };
  }
  revalidatePath("/", "layout");
  return { ok: true, removed: (data as { removed: number }).removed };
}
