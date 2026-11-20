import { ArrowUpRightIcon } from "lucide-react";
import { type Announcement, TONE_STYLES } from "@/lib/announcements";
import { cn } from "@/lib/utils";

// One announcement as a banner strip: a bold headline, the message and an
// optional dark button (owner, Nov 20; like HubSpot's top banner). Used on the
// main page and as the preview in Settings → Announcements.
export function AnnouncementStrip({
  a,
  className,
  children,
}: {
  a: Pick<Announcement, "headline" | "message" | "linkLabel" | "linkUrl" | "tone">;
  className?: string;
  // Extra controls on the right (dots, close button).
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative", TONE_STYLES[a.tone].strip, className)}>
      <div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-12 py-3 text-center text-sm sm:text-base">
        <p className="min-w-0 leading-snug">
          <strong className="font-bold">{a.headline}</strong>
          {a.message && <> {a.message}</>}
        </p>
        {a.linkLabel && a.linkUrl && <AnnouncementButton label={a.linkLabel} url={a.linkUrl} />}
      </div>
      {children}
    </div>
  );
}

export function AnnouncementButton({ label, url, small = false }: { label: string; url: string; small?: boolean }) {
  const external = url.startsWith("https://");
  return (
    <a
      href={url}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-lg bg-gray-900 font-semibold text-white transition-colors hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 dark:focus-visible:outline-white",
        small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
      )}
    >
      {label}
      {external && <ArrowUpRightIcon className={small ? "size-3.5" : "size-4"} aria-hidden />}
      {external && <span className="sr-only"> (opens in a new tab)</span>}
    </a>
  );
}
