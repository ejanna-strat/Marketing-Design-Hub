import { redirect } from "next/navigation";
import { AuthShell } from "@/components/shell/AuthShell";
import { theme } from "@/config/theme";
import { createClient } from "@/lib/supabase/server";
import { SignUpForm } from "./SignUpForm";

export const metadata = { title: `Create an account · ${theme.appName}` };

export default async function SignUpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <AuthShell subtitle="Create your account with your @stratpoint.com email.">
      <SignUpForm />
    </AuthShell>
  );
}
