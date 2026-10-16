import { AuthShell } from "@/components/shell/AuthShell";
import { theme } from "@/config/theme";
import { requireUser } from "@/lib/auth";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: `Set a new password · ${theme.appName}` };

// Reached from the reset-password email link (which signs the person in).
export default async function ResetPasswordPage() {
  const user = await requireUser();
  return (
    <AuthShell subtitle={`Choose a new password for ${user.email}.`}>
      <ResetPasswordForm />
    </AuthShell>
  );
}
