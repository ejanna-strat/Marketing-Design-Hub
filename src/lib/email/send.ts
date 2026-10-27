import "server-only";
import { render } from "@react-email/components";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

type SendResult = "sent" | "skipped" | "failed";

// Sends one notification and records it in notifications_log.
//
// - Once-only emails are "claimed" with a pending log row first. A unique
//   index on (request_id, notification_key) makes a second claim fail, so the
//   same email can never go out twice. A failed send frees the claim.
// - EMAIL_TEST_MODE=true sends everything to EMAIL_TEST_RECIPIENT instead,
//   with the real recipients shown in the subject.
// - Never throws: a failed email must not undo the change that triggered it.
export async function sendEmail({
  key,
  requestId,
  to,
  subject,
  email,
  onceOnly = true,
}: {
  key: string;
  requestId: string;
  to: string[];
  subject: string;
  email: React.ReactElement;
  onceOnly?: boolean;
}): Promise<SendResult> {
  const recipients = [...new Set(to.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const db = createAdminClient();

  const { data: claim, error: claimError } = await db
    .from("notifications_log")
    .insert({ request_id: requestId, notification_key: key, recipients, once_only: onceOnly, status: "pending" })
    .select("id")
    .single();
  if (claimError) {
    if (claimError.code === "23505") return "skipped"; // already sent
    console.error(`[email ${key}] could not write the log`, claimError);
    return "failed";
  }

  const finish = async (status: "sent" | "failed", error?: string) => {
    const { error: logError } = await db
      .from("notifications_log")
      .update({ status, error: error ?? null, sent_at: new Date().toISOString() })
      .eq("id", claim.id);
    if (logError) console.error(`[email ${key}] could not update the log`, logError);
    if (error) console.error(`[email ${key}] ${error}`);
    return status;
  };

  try {
    if (recipients.length === 0) return await finish("failed", "No recipients");
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey === "re_xxx") return await finish("failed", "RESEND_API_KEY is not set");

    const testMode = process.env.EMAIL_TEST_MODE !== "false";
    const testRecipient = process.env.EMAIL_TEST_RECIPIENT;
    if (testMode && !testRecipient) return await finish("failed", "EMAIL_TEST_MODE is on but EMAIL_TEST_RECIPIENT is not set");

    const { error } = await new Resend(apiKey).emails.send({
      from: process.env.EMAIL_FROM || "Marketing Creative Hub <onboarding@resend.dev>",
      to: testMode ? [testRecipient!] : recipients,
      subject: testMode ? `[TEST → ${recipients.join(", ")}] ${subject}` : subject,
      html: await render(email),
      text: await render(email, { plainText: true }),
    });
    if (error) return await finish("failed", `${error.name}: ${error.message}`);
    return await finish("sent");
  } catch (e) {
    return await finish("failed", e instanceof Error ? e.message : String(e));
  }
}
