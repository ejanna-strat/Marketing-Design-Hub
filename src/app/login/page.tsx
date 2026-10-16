import { redirect } from "next/navigation";
import { AuthShell } from "@/components/shell/AuthShell";
import { theme } from "@/config/theme";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const metadata = { title: `Sign in · ${theme.appName}` };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect("/");

  return (
    <AuthShell subtitle="Sign in with your @stratpoint.com email.">
      <LoginForm
        next={next}
        initialError={error === "link" ? "That link is invalid or has expired. Please try again." : undefined}
      />
    </AuthShell>
  );
}
