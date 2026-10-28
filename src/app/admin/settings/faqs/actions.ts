"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

const NOT_ALLOWED = "Only Super Admins, Admins and Lead Designers can edit the FAQs.";

const faqSchema = z.object({
  id: z.string().uuid().optional(),
  question: z
    .string()
    .trim()
    .min(1, "Please enter the question.")
    .max(300, "Please keep the question under 300 characters."),
  answer: z
    .string()
    .trim()
    .min(1, "Please enter the answer.")
    .max(5000, "Please keep the answer under 5,000 characters."),
  visible: z.boolean(),
});

export type FaqInput = z.input<typeof faqSchema>;

function failed(error: { message: string }): Result {
  console.error("faq update failed", error);
  return { ok: false, error: "We couldn't save the change. Please try again." };
}

function refresh() {
  revalidatePath("/admin/settings/faqs");
  revalidatePath("/");
}

// Adds an FAQ at the bottom of the list, or saves changes to one.
export async function saveFaq(input: FaqInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user?.canManageMembers) return { ok: false, error: NOT_ALLOWED };

  const parsed = faqSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check the form.",
    };
  const { id, question, answer, visible } = parsed.data;

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase
      .from("faqs")
      .update({
        question,
        answer,
        visible,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return failed(error);
  } else {
    const { data: last } = await supabase
      .from("faqs")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("faqs").insert({
      question,
      answer,
      visible,
      position: (last?.position ?? 0) + 1,
    });
    if (error) return failed(error);
  }

  refresh();
  return { ok: true };
}

export async function deleteFaq(id: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user?.canManageMembers) return { ok: false, error: NOT_ALLOWED };

  const supabase = await createClient();
  const { error } = await supabase.from("faqs").delete().eq("id", id);
  if (error) return failed(error);

  refresh();
  return { ok: true };
}

// Saves a new order: the FAQ ids from top to bottom.
export async function reorderFaqs(ids: string[]): Promise<Result> {
  const user = await getCurrentUser();
  if (!user?.canManageMembers) return { ok: false, error: NOT_ALLOWED };
  if (!z.array(z.string().uuid()).safeParse(ids).success) return { ok: false, error: "Please try again." };

  const supabase = await createClient();
  const results = await Promise.all(
    ids.map((id, i) =>
      supabase
        .from("faqs")
        .update({ position: i + 1 })
        .eq("id", id),
    ),
  );
  const error = results.find((r) => r.error)?.error;
  if (error) return failed(error);

  refresh();
  return { ok: true };
}
