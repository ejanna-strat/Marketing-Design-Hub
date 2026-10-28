import { redirect } from "next/navigation";
import { SpamNotice } from "@/components/SpamNotice";
import { AuthShell, FormNotice } from "@/components/shell/AuthShell";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; reason?: string }>;
}) {
  const { next, error, reason } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect("/");

  return (
    <AuthShell subtitle="Sign in with your @stratpoint.com email.">
      {/* Auto sign-out (src/lib/idle.ts). */}
      <FormNotice>
        {reason === "idle" && "You were signed out after a period of inactivity. Please sign in again."}
      </FormNotice>
      <LoginForm
        next={next}
        initialError={error === "link" ? "That link is invalid or has expired. Please try again." : undefined}
      />
      <SpamNotice senderOnOwnLine />
    </AuthShell>
  );
}
