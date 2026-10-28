import type { ReactNode } from "react";

// FAQ answers are plain text the Marketing team types in Settings → Requester
// FAQs. Supported: blank line = new paragraph, lines starting with "- " =
// bullet list, **bold**, [link text](https://… or mailto:…).
const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\((?:https?:\/\/|mailto:)[^)\s]+\))/g;

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const external = link[2].startsWith("http");
      return (
        <a
          key={i}
          href={link[2]}
          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
          className="font-medium text-brand underline underline-offset-2"
        >
          {link[1]}
        </a>
      );
    }
    return part;
  });
}

export function FaqAnswer({ text }: { text: string }) {
  const blocks = text
    .trim()
    .split(/\n\s*\n/)
    .map((b) =>
      b
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    );

  return (
    <div className="space-y-3">
      {blocks.map((lines, i) =>
        lines.every((l) => l.startsWith("- ")) ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {lines.map((l, j) => (
              <li key={j}>{inline(l.slice(2))}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  );
}
