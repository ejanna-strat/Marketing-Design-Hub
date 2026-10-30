"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { FormError, FormNotice } from "@/components/shell/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { resendConfirmation, signIn } from "./actions";

export function LoginForm({
  next,
  initialError,
}: {
  next?: string;
  initialError?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState<string>();
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setNotice(undefined);
    startTransition(async () => {
      // On success the action redirects, so a result means it failed.
      const result = await signIn(email, password, next);
      if (result && !result.ok) {
        setError(result.error);
        setUnconfirmed(!!result.unconfirmed);
      }
    });
  }

  function resend() {
    setError(undefined);
    startTransition(async () => {
      const result = await resendConfirmation(email);
      if (result.ok) {
        setNotice(result.message);
        setUnconfirmed(false);
      } else setError(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormNotice>{notice}</FormNotice>
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
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-xs text-brand underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <FormError>{error}</FormError>
      {unconfirmed && (
        <button
          type="button"
          onClick={resend}
          disabled={pending}
          className="text-sm text-brand underline-offset-4 hover:underline disabled:opacity-50"
        >
          Send the confirmation email again
        </button>
      )}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        First time here?{" "}
        <Link href="/signup" className="font-medium text-brand underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
