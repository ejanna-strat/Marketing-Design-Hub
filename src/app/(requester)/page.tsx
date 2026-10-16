import { ArrowRightIcon, ClockIcon, ExternalLinkIcon, FilePlus2Icon, ListChecksIcon, MessageSquareHeartIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { links } from "@/config/links";
import { theme } from "@/config/theme";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

const actions: { href?: string; external?: boolean; title: string; description: string; icon: typeof ClockIcon }[] = [
  {
    href: "/requests/new",
    title: "New Design Request",
    description: "Tell the Design team what you need.",
    icon: FilePlus2Icon,
  },
  {
    href: "/my-requests",
    title: "Track My Request",
    description: "See the status of the requests you filed.",
    icon: ListChecksIcon,
  },
  {
    title: "Share Feedback",
    description: "Rate a completed design request.",
    icon: MessageSquareHeartIcon,
  },
  {
    href: links.designSlas,
    external: true,
    title: "See Design SLAs",
    description: "How long each type of design takes.",
    icon: ClockIcon,
  },
];

export default async function HomePage() {
  const user = await requireUser();
  const firstName = user.fullName.split(" ")[0];

  return (
    <div className="mx-auto max-w-4xl space-y-10 py-6">
      <div className="space-y-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand">
          {firstName ? `Hi, ${firstName}` : "Stratpoint Marketing"}
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">{theme.appName}</h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          One place to submit design requests, track progress, and understand our design service timelines.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {actions.map(({ href, external, title, description, icon: Icon }) => {
          const body = (
            <>
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl",
                  href ? "bg-brand text-white" : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className="space-y-1">
                <span className="flex items-center gap-2 font-semibold">
                  {title}
                  {external && <ExternalLinkIcon className="size-4 text-muted-foreground" aria-label="(opens in a new tab)" />}
                  {!href && <Badge variant="secondary">Coming soon</Badge>}
                </span>
                <span className="block text-sm text-muted-foreground">{description}</span>
              </span>
            </>
          );
          const base = "flex items-start gap-4 rounded-xl border bg-background p-5 text-left";
          const active = cn(base, "transition-colors hover:border-brand hover:bg-brand-soft/40 focus-visible:ring-3 focus-visible:ring-ring/50 outline-none");
          if (href && external) {
            return (
              <a key={title} href={href} target="_blank" rel="noreferrer" className={active}>
                {body}
              </a>
            );
          }
          return href ? (
            <Link key={title} href={href} className={active}>
              {body}
            </Link>
          ) : (
            <div key={title} aria-disabled className={cn(base, "cursor-not-allowed opacity-60")}>
              {body}
            </div>
          );
        })}
      </div>

      {user.isStaff && (
        <p className="text-center text-sm text-muted-foreground">
          Marketing team?{" "}
          <Link href="/admin/pipeline" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
            Go to Design Pipeline
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </p>
      )}
    </div>
  );
}
