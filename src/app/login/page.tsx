import { redirect } from "next/navigation";
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-soft/40 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-background p-6 shadow-sm">
        <div className="space-y-1 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">Stratpoint Marketing</p>
          <h1 className="text-2xl font-bold">{theme.appName}</h1>
          <p className="text-sm text-muted-foreground">Sign in with your @stratpoint.com email.</p>
        </div>
        <LoginForm
          next={next}
          initialError={error === "link" ? "That sign-in link is invalid or has expired. Please request a new one." : undefined}
        />
      </div>
    </main>
  );
}
