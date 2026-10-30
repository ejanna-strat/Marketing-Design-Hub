import {
  ChevronDownIcon,
  ClockIcon,
  ExternalLinkIcon,
  FilePlus2Icon,
  ListChecksIcon,
  MessageSquareHeartIcon,
} from "lucide-react";
import Link from "next/link";
import { FaqAnswer } from "@/components/FaqAnswer";
import { SpamNotice } from "@/components/SpamNotice";
import { Badge } from "@/components/ui/badge";
import { links } from "@/config/links";
import { theme } from "@/config/theme";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const actions: { href?: string; external?: boolean; title: string; description: string; icon: typeof ClockIcon }[] = [
  {
    href: "/requests/new",
    title: "New Design Request",
    description: "Tell the Brand team what you need.",
    icon: FilePlus2Icon,
  },
  {
    href: "/my-requests",
    title: "Track My Request",
    description: "See the status of the requests you filed.",
    icon: ListChecksIcon,
  },
  {
    href: "/feedback",
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
  const supabase = await createClient();
  // Hidden FAQs are left out here even for the people who can see them in Settings.
  const { data: faqs } = await supabase
    .from("faqs")
    .select("id, question, answer")
    .eq("visible", true)
    .order("position");
  const firstName = user.fullName.split(" ")[0];

  return (
    <div className="mx-auto max-w-4xl space-y-10 py-6">
      <div className="space-y-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand">
          {firstName ? `Hi, ${firstName}` : "Stratpoint Marketing"}
        </p>
        <h1 className="font-brand text-3xl font-bold text-brand sm:text-4xl">{theme.appName}</h1>
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

      <SpamNotice />

      {faqs && faqs.length > 0 && (
        <section aria-labelledby="faq-heading" className="space-y-4">
          <h2 id="faq-heading" className="text-center text-xl font-bold">
            Frequently Asked Questions
          </h2>
          <div className="divide-y rounded-xl border bg-background">
            {faqs.map((f) => (
              <details key={f.id} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium outline-none hover:text-brand focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                  {f.question}
                  <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                  <FaqAnswer text={f.answer} />
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
