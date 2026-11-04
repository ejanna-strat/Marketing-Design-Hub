import { ExternalLinkIcon } from "lucide-react";
import type { OutputLinkItem } from "@/lib/links";
import { cn } from "@/lib/utils";

const URL_RE = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;

// Text with any http(s) links made clickable. Keeps line breaks.
export function LinkifiedText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(URL_RE);
  return (
    <span className={cn("break-words whitespace-pre-wrap", className)}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noreferrer" className="text-brand underline underline-offset-2">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </span>
  );
}

// The Link to Output cell: a short "Open link" for a URL, the text otherwise.
export function OutputLink({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  if (/^https?:\/\/\S+$/.test(value)) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        title={value}
        className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
      >
        Open link
        <ExternalLinkIcon className="size-3.5" />
      </a>
    );
  }
  return <LinkifiedText text={value} className="line-clamp-2" />;
}

function NamedLink({ link }: { link: OutputLinkItem }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer"
      title={link.url}
      className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
    >
      {link.label}
      <ExternalLinkIcon className="size-3.5 shrink-0" />
    </a>
  );
}

// Every Link to Output, one per line, by its name ("Output link" or "Link 1"
// if unnamed).
export function OutputLinkList({ links }: { links: OutputLinkItem[] }) {
  if (links.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <ul className="space-y-1">
      {links.map((link, i) => (
        <li key={i}>
          <NamedLink link={link} />
        </li>
      ))}
    </ul>
  );
}

// The table cell: the first link ("Open link" when it has no name) and "+N"
// for the others, listed in its tooltip.
export function OutputLinksCell({ links }: { links: OutputLinkItem[] }) {
  if (links.length === 0) return <span className="text-muted-foreground">—</span>;
  const [first, ...rest] = links;
  return (
    <span className="inline-flex items-center gap-1.5">
      {first.named ? <NamedLink link={first} /> : <OutputLink value={first.url} />}
      {rest.length > 0 && (
        <span
          title={rest.map((l) => `${l.label}: ${l.url}`).join("\n")}
          className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
        >
          +{rest.length}
        </span>
      )}
    </span>
  );
}
