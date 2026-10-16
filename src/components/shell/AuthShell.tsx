import Image from "next/image";
import { theme } from "@/config/theme";

// The centred card used by sign in, sign up and password pages.
export function AuthShell({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-soft/40 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-background p-6 shadow-sm">
        <div className="space-y-1 text-center">
          <Image src="/brand/logo.png" alt="" width={56} height={56} priority className="mx-auto mb-2" />
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Stratpoint Marketing</p>
          <h1 className="font-brand text-2xl font-bold text-brand">{theme.appName}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </div>
    </main>
  );
}

export function FormError({ children }: { children?: React.ReactNode }) {
  return children ? <p className="text-sm text-destructive">{children}</p> : null;
}

export function FormNotice({ children }: { children?: React.ReactNode }) {
  return children ? <p className="rounded-lg bg-brand-soft p-3 text-sm">{children}</p> : null;
}
