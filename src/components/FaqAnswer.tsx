import type { ReactNode } from "react";
import { type FaqInline, parseFaq } from "@/lib/faq-format";

// Shows an FAQ answer (formatting codes in src/lib/faq-format.ts).
function inline(nodes: FaqInline[]): ReactNode[] {
  return nodes.map((n, i) => {
    if (n.kind === "text") return n.text;
    const inner = inline(n.children);
    if (n.kind === "bold") {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {inner}
        </strong>
      );
    }
    if (n.kind === "italic") return <em key={i}>{inner}</em>;
    if (n.kind === "underline") {
      return (
        <u key={i} className="underline-offset-2">
          {inner}
        </u>
      );
    }
    const external = n.href.startsWith("http");
    return (
      <a
        key={i}
        href={n.href}
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
        className="font-medium text-brand underline underline-offset-2"
      >
        {inner}
      </a>
    );
  });
}

export function FaqAnswer({ text }: { text: string }) {
  return (
    <div className="space-y-3">
      {parseFaq(text).map((b, i) =>
        b.kind === "ul" ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {b.lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(line)}
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  );
}
