"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { requestPasswordReset } from "@/app/login/actions";
import { AuthShell, FormError, FormNotice } from "@/components/shell/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Also how people with an older account (made with the email code) set
// their first password.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await requestPasswordReset(email);
      if (result.ok) setDone(result.message);
      else setError(result.error);
    });
  }

  return (
    <AuthShell subtitle="Set a new password. We'll email you a link.">
      {done ? (
        <div className="space-y-4">
          <FormNotice>{done}</FormNotice>
          <Button asChild className="w-full" size="lg" variant="outline">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="name@stratpoint.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <FormError>{error}</FormError>
          <Button type="submit" className="w-full" size="lg" disabled={pending}>
            {pending ? "Sending…" : "Email me a link"}
          </Button>
          <p className="text-center text-sm">
            <Link href="/login" className="text-muted-foreground underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
