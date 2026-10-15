"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendLoginEmail, verifyLoginCode } from "./actions";

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState<string>();
  const [pending, startTransition] = useTransition();

  function sendEmail(e?: React.FormEvent) {
    e?.preventDefault();
    setError(undefined);
    setNotice(undefined);
    startTransition(async () => {
      const result = await sendLoginEmail(email);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStep("code");
      setNotice(`We sent a sign-in email to ${email.trim().toLowerCase()}.`);
    });
  }

  function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      // On success the action redirects, so a result means it failed.
      const result = await verifyLoginCode(email, code, next);
      if (result && !result.ok) setError(result.error);
    });
  }

  if (step === "email") {
    return (
      <form onSubmit={sendEmail} className="space-y-4">
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
          <p className="text-xs text-muted-foreground">Use your main email address, not an alias.</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? "Sending…" : "Send sign-in email"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyCode} className="space-y-4">
      {notice && <p className="rounded-lg bg-brand-soft p-3 text-sm">{notice} Click the link in it, or type the code below.</p>}
      <div className="space-y-2">
        <Label htmlFor="code">Code from the email</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          maxLength={8}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="text-center text-lg tracking-[0.4em]"
          required
          autoFocus
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <div className="flex justify-between text-sm">
        <button
          type="button"
          className="text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => {
            setStep("email");
            setCode("");
            setError(undefined);
          }}
        >
          Use a different email
        </button>
        <button
          type="button"
          className="text-brand underline-offset-4 hover:underline disabled:opacity-50"
          onClick={() => sendEmail()}
          disabled={pending}
        >
          Send a new email
        </button>
      </div>
    </form>
  );
}
