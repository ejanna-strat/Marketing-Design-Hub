"use client";

import { MailWarningIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { signUp } from "@/app/login/actions";
import { FormError, FormNotice } from "@/components/shell/AuthShell";
import { EMAIL_SENDER, EMAIL_SENDER_NAME } from "@/components/SpamNotice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD, STRATPOINT_EMAIL } from "@/lib/auth-rules";

export function SignUpForm() {
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  // Pop-up after signing up: check spam and mark "Not spam" (owner, Oct 22).
  const [spamTip, setSpamTip] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (!STRATPOINT_EMAIL.test(form.email.trim().toLowerCase())) {
      setError("Please use your @stratpoint.com email address.");
      return;
    }
    if (form.password.length < MIN_PASSWORD) {
      setError(`Please use at least ${MIN_PASSWORD} characters for your password.`);
      return;
    }
    if (form.password !== form.confirm) {
      setError("The two passwords don't match.");
      return;
    }
    startTransition(async () => {
      const result = await signUp({ fullName: form.fullName, email: form.email, password: form.password });
      if (!result) return; // signed in straight away (redirected)
      if (result.ok) {
        setDone(result.message);
        setSpamTip(true);
      }
      else setError(result.error);
    });
  }

  if (done) {
    return (
      <div className="space-y-4">
        <FormNotice>{done}</FormNotice>
        <Button asChild className="w-full" size="lg" variant="outline">
          <Link href="/login">Back to sign in</Link>
        </Button>
        <Dialog open={spamTip} onOpenChange={setSpamTip}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MailWarningIcon className="size-5 text-amber-600" aria-hidden />
                Check your email to finish signing up
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-3 text-sm">
                  <p>
                    We sent a confirmation link to <span className="font-medium text-foreground">{form.email.trim()}</span>.
                  </p>
                  <p>
                    It may land in your <span className="font-medium text-foreground">Spam or Junk</span> folder. If so,
                    open it and mark it as <span className="font-medium text-foreground">&ldquo;Not spam&rdquo;</span> so
                    our future emails (like request updates) reach your inbox.
                  </p>
                  <p>
                    Emails come from{" "}
                    <span className="font-medium text-foreground">
                      {EMAIL_SENDER_NAME} ({EMAIL_SENDER})
                    </span>
                    .
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" onClick={() => setSpamTip(false)} autoFocus>
                Got it
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" autoComplete="name" value={form.fullName} onChange={set("fullName")} required autoFocus />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="name@stratpoint.com"
          value={form.email}
          onChange={set("email")}
          required
        />
        <p className="text-xs text-muted-foreground">Use your main email address, not an alias.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          value={form.password}
          onChange={set("password")}
          required
        />
        <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD} characters.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <PasswordInput
          id="confirm"
          autoComplete="new-password"
          value={form.confirm}
          onChange={set("confirm")}
          required
        />
      </div>
      <FormError>{error}</FormError>
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Creating your account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
