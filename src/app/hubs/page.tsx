import { ArrowRightIcon, NewspaperIcon, PaletteIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { IdleSignOut } from "@/components/shell/IdleSignOut";
import { roleLabel } from "@/components/shell/AppHeader";
import { UserMenu } from "@/components/shell/UserMenu";
import { theme } from "@/config/theme";
import { requireUser } from "@/lib/auth";

// The Marketing Support Hub's front door (owner, Nov 13): everyone lands here
// after signing in and picks a hub. Creative Hub is the design-request app;
// Content Requests is coming later. Old links and email buttons still open
// their page directly.
export default async function HubsPage() {
  const user = await requireUser();
  const firstName = user.fullName.split(" ")[0];

  return (
    <div className="min-h-screen bg-brand-soft/40">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
          <Image src="/brand/logo.png" alt="" width={30} height={30} priority />
          <span className="flex-1 font-brand font-bold text-brand">{theme.suiteName}</span>
          <UserMenu name={user.fullName} email={user.email} roleLabel={roleLabel(user)} theme={user.theme} />
        </div>
        <IdleSignOut team={user.isStaff} />
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-12 sm:px-6">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">
            {firstName ? `Hi, ${firstName}` : "Stratpoint Marketing"}
          </p>
          <h1 className="font-brand text-3xl font-bold text-brand">Where would you like to go?</h1>
          <p className="text-muted-foreground">Choose the hub for what you need from the Marketing team.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/"
            className="group flex flex-col gap-3 rounded-xl border bg-background p-6 shadow-sm transition hover:border-brand hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand"
          >
            <span className="flex size-11 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <PaletteIcon className="size-6" aria-hidden />
            </span>
            <span className="font-brand text-xl font-bold">{theme.appName}</span>
            <span className="flex-1 text-sm text-muted-foreground">
              Design requests: decks, social media, event materials and more. File a request and track it to delivery.
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-brand">
              Open {theme.appName}
              <ArrowRightIcon className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>

          <div
            aria-disabled="true"
            className="flex flex-col gap-3 rounded-xl border border-dashed bg-background/60 p-6 text-muted-foreground"
          >
            <span className="flex size-11 items-center justify-center rounded-lg bg-muted">
              <NewspaperIcon className="size-6" aria-hidden />
            </span>
            <span className="flex items-center gap-2">
              <span className="font-brand text-xl font-bold">Content Requests</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">Coming soon</span>
            </span>
            <span className="flex-1 text-sm">Content requests: articles, copy and more. Coming soon.</span>
          </div>
        </div>
      </main>
    </div>
  );
}
