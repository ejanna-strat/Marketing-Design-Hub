import { AuthShell } from "@/components/shell/AuthShell";
import { requireUser } from "@/lib/auth";
import { ResetPasswordForm } from "./ResetPasswordForm";

// Reached from the reset-password email link (which signs the person in).
export default async function ResetPasswordPage() {
  const user = await requireUser();
  return (
    <AuthShell subtitle={`Choose a new password for ${user.email}.`}>
      <ResetPasswordForm />
    </AuthShell>
  );
}
