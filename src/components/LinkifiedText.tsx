import { ExternalLinkIcon } from "lucide-react";
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
