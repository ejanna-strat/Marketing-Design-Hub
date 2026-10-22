import { redirect } from "next/navigation";
import { SpamNotice } from "@/components/SpamNotice";
import { AuthShell } from "@/components/shell/AuthShell";
import { createClient } from "@/lib/supabase/server";
import { SignUpForm } from "./SignUpForm";

export default async function SignUpPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect("/");

  return (
    <AuthShell subtitle="Create your account with your @stratpoint.com email.">
      <SignUpForm />
      <SpamNotice senderOnOwnLine />
    </AuthShell>
  );
}
