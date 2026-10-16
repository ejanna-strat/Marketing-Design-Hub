import { redirect } from "next/navigation";
import { SpamNotice } from "@/components/SpamNotice";
import { AuthShell } from "@/components/shell/AuthShell";
import { theme } from "@/config/theme";
import { createClient } from "@/lib/supabase/server";
import { SignUpForm } from "./SignUpForm";

export const metadata = { title: `Create an account · ${theme.appName}` };

export default async function SignUpPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect("/");

  return (
    <AuthShell subtitle="Create your account with your @stratpoint.com email.">
      <SignUpForm />
      <SpamNotice />
    </AuthShell>
  );
}
