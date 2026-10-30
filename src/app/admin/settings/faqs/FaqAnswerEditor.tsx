"use client";

import { BoldIcon, ItalicIcon, ListIcon, PaperclipIcon, UnderlineIcon, Unlink2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SAFE_HREF, fromHtml, inlineHtml, parseFaq, toHtml } from "@/lib/faq-format";
import { cn } from "@/lib/utils";

type Format = "bold" | "italic" | "underline" | "insertUnorderedList";

const TOOLS: { command: Format; label: string; keys: string; icon: typeof BoldIcon }[] = [
  { command: "bold", label: "Bold", keys: "Ctrl/⌘ B", icon: BoldIcon },
  { command: "italic", label: "Italic", keys: "Ctrl/⌘ I", icon: ItalicIcon },
  { command: "underline", label: "Underline", keys: "Ctrl/⌘ U", icon: UnderlineIcon },
  { command: "insertUnorderedList", label: "Bullet list", keys: "", icon: ListIcon },
];

// "name@stratpoint.com" → mailto:, "example.com" → https://.
function normalizeHref(raw: string) {
  const v = raw.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  if (/^(https?:\/\/|mailto:)/i.test(v)) return v;
  return v ? `https://${v}` : "";
}

// What-you-see editor for FAQ answers. It edits HTML in the browser but hands
// back the answer as formatting codes (src/lib/faq-format.ts), so only bold,
// italic, underline, links, bullets and paragraphs are ever saved.
// Uses the browser's built-in editing commands (no editor library).
export function FaqAnswerEditor({
  initial,
  onChange,
  labelId,
}: {
  initial: string;
  onChange: (answer: string) => void;
  labelId: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [active, setActive] = useState<Partial<Record<Format | "link", boolean>>>({});
  const [link, setLink] = useState<{ href: string; existing: boolean } | null>(null);
  const [hint, setHint] = useState<string>();

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = toHtml(initial);
    document.execCommand("defaultParagraphSeparator", false, "p");
    document.execCommand("styleWithCSS", false, "false");
  }, [initial]);

  // Lights up the toolbar buttons for the text under the cursor.
  useEffect(() => {
    function update() {
      const sel = document.getSelection();
      if (!ref.current || !sel?.anchorNode || !ref.current.contains(sel.anchorNode)) return;
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        insertUnorderedList: document.queryCommandState("insertUnorderedList"),
        link: !!anchorAt(sel.anchorNode),
      });
    }
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, []);

  function anchorAt(node: Node | null) {
    const el = node instanceof Element ? node : node?.parentElement;
    const a = el?.closest("a");
    return a && ref.current?.contains(a) ? a : null;
  }

  function sync() {
    if (ref.current) onChange(fromHtml(ref.current));
  }

  function run(command: Format | "createLink" | "unlink", value?: string) {
    ref.current?.focus();
    document.execCommand(command, false, value);
    sync();
  }

  function restoreSelection() {
    const sel = document.getSelection();
    ref.current?.focus();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  }

  // Paperclip: link the highlighted words (or change the link under the cursor).
  function openLink() {
    const sel = document.getSelection();
    if (!ref.current || !sel || sel.rangeCount === 0 || !ref.current.contains(sel.anchorNode)) {
      setHint("Highlight the words you want to link first.");
      return;
    }
    const range = sel.getRangeAt(0);
    const a = anchorAt(sel.anchorNode);
    if (range.collapsed && !a) {
      setHint("Highlight the words you want to link first.");
      return;
    }
    if (range.collapsed && a) range.selectNodeContents(a);
    savedRange.current = range.cloneRange();
    setHint(undefined);
    setLink({ href: a?.getAttribute("href")?.replace(/^mailto:/, "") ?? "", existing: !!a });
  }

  function applyLink() {
    if (!link) return;
    const href = normalizeHref(link.href);
    if (!SAFE_HREF.test(href)) {
      setHint("Please enter a web address (https://…) or an email address.");
      return;
    }
    restoreSelection();
    run("createLink", href);
    setLink(null);
    setHint(undefined);
  }

  function removeLink() {
    restoreSelection();
    run("unlink");
    setLink(null);
  }

  // Pasted text keeps only bold, italic, underline, links and bullets.
  function paste(e: React.ClipboardEvent) {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const codes = html
      ? fromHtml(new DOMParser().parseFromString(html, "text/html").body)
      : e.clipboardData.getData("text/plain");
    const blocks = parseFaq(codes);
    if (blocks.length === 0) return;
    const single = blocks.length === 1 && blocks[0].kind === "p" ? blocks[0] : null;
    document.execCommand("insertHTML", false, single ? single.lines.map(inlineHtml).join("<br>") : toHtml(codes));
    sync();
  }

  function keyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openLink();
    }
  }

  return (
    <div className="rounded-lg border focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1"
      >
        {TOOLS.map(({ command, label, keys, icon: Icon }) => (
          <Button
            key={command}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            aria-pressed={!!active[command]}
            title={keys ? `${label} (${keys})` : label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(command)}
            className={cn(active[command] && "bg-background text-brand shadow-xs")}
          >
            <Icon />
          </Button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={active.link ? "Edit link" : "Add link"}
          aria-pressed={!!active.link}
          title={`${active.link ? "Edit link" : "Add link to highlighted text"} (Ctrl/⌘ K)`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={openLink}
          className={cn(active.link && "bg-background text-brand shadow-xs")}
        >
          <PaperclipIcon />
        </Button>
      </div>

      {link && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 p-2">
          <Input
            autoFocus
            aria-label="Link address"
            placeholder="https://… or name@stratpoint.com"
            value={link.href}
            onChange={(e) => setLink({ ...link, href: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
            }}
            className="h-8 min-w-0 flex-1 basis-48"
          />
          <Button type="button" size="sm" onClick={applyLink}>
            {link.existing ? "Update link" : "Add link"}
          </Button>
          {link.existing && (
            <Button type="button" size="sm" variant="ghost" onClick={removeLink}>
              <Unlink2Icon />
              Remove
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={() => setLink(null)}>
            Cancel
          </Button>
        </div>
      )}

      <div
        ref={ref}
        role="textbox"
        aria-multiline
        aria-labelledby={labelId}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onBlur={sync}
        onPaste={paste}
        onKeyDown={keyDown}
        className="max-h-80 min-h-44 overflow-y-auto px-3 py-2 text-sm leading-relaxed outline-none [&_a]:font-medium [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2 [&_b]:font-semibold [&_p+p]:mt-3 [&_p+ul]:mt-2 [&_strong]:font-semibold [&_u]:underline-offset-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul+p]:mt-3"
      />

      {hint && <p className="border-t px-3 py-1.5 text-xs text-destructive">{hint}</p>}
    </div>
  );
}
