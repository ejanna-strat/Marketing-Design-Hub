// FAQ answers are saved as plain text with a few formatting codes, so nothing
// typed or pasted in the editor can put HTML on the home page:
//   blank line = new paragraph · "- " at the start of a line = bullet
//   **bold** · *italic* · __underline__ · [link text](https://… or mailto:…)
// The home page (FaqAnswer) and the editor (FaqAnswerEditor) both read it
// with parseFaq(); the editor saves with fromHtml().

export type FaqInline =
  | { kind: "text"; text: string }
  | { kind: "bold"; children: FaqInline[] }
  | { kind: "italic"; children: FaqInline[] }
  | { kind: "underline"; children: FaqInline[] }
  | { kind: "link"; href: string; children: FaqInline[] };

export type FaqBlock = { kind: "p"; lines: FaqInline[][] } | { kind: "ul"; items: FaqInline[][] };

export const SAFE_HREF = /^(?:https?:\/\/|mailto:)[^\s()]+$/;

// ***x*** = bold + italic. Single * for italic must not be part of a ** pair.
const TOKEN =
  /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|__(.+?)__|\*(?!\*)(.+?)(?<!\*)\*(?!\*)|\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s()]+)\)/;

export function parseInline(text: string): FaqInline[] {
  const out: FaqInline[] = [];
  let rest = text;
  while (rest) {
    const m = TOKEN.exec(rest);
    if (!m) {
      out.push({ kind: "text", text: rest });
      break;
    }
    if (m.index) out.push({ kind: "text", text: rest.slice(0, m.index) });
    if (m[1] !== undefined) out.push({ kind: "bold", children: [{ kind: "italic", children: parseInline(m[1]) }] });
    else if (m[2] !== undefined) out.push({ kind: "bold", children: parseInline(m[2]) });
    else if (m[3] !== undefined) out.push({ kind: "underline", children: parseInline(m[3]) });
    else if (m[4] !== undefined) out.push({ kind: "italic", children: parseInline(m[4]) });
    else out.push({ kind: "link", href: m[6], children: parseInline(m[5]) });
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

export function parseFaq(text: string): FaqBlock[] {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((b) =>
      b
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    )
    .filter((lines) => lines.length > 0)
    .map((lines) =>
      lines.every((l) => l.startsWith("- "))
        ? { kind: "ul", items: lines.map((l) => parseInline(l.slice(2))) }
        : { kind: "p", lines: lines.map(parseInline) },
    );
}

// The answer without codes, for short previews.
export function faqPlainText(text: string) {
  const flat = (nodes: FaqInline[]): string =>
    nodes.map((n) => (n.kind === "text" ? n.text : flat(n.children))).join("");
  return parseFaq(text)
    .map((b) => (b.kind === "p" ? b.lines.map(flat).join(" ") : b.items.map((i) => `• ${flat(i)}`).join(" ")))
    .join(" ");
}

// ---- Editor: codes → HTML (escaped) ----

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function inlineHtml(nodes: FaqInline[]): string {
  return nodes
    .map((n) => {
      if (n.kind === "text") return escape(n.text);
      const inner = inlineHtml(n.children);
      if (n.kind === "bold") return `<strong>${inner}</strong>`;
      if (n.kind === "italic") return `<em>${inner}</em>`;
      if (n.kind === "underline") return `<u>${inner}</u>`;
      return `<a href="${escape(n.href)}">${inner}</a>`;
    })
    .join("");
}

export function toHtml(text: string): string {
  const html = parseFaq(text)
    .map((b) =>
      b.kind === "p"
        ? `<p>${b.lines.map(inlineHtml).join("<br>")}</p>`
        : `<ul>${b.items.map((i) => `<li>${inlineHtml(i)}</li>`).join("")}</ul>`,
    )
    .join("");
  return html || "<p><br></p>";
}

// ---- Editor: HTML → codes (also cleans pasted Google Docs / Word content) ----

const BLOCK_TAGS = ["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "SECTION", "ARTICLE", "TABLE", "TR"];
const BLOCK_SELECTOR = [...BLOCK_TAGS, "UL", "OL", "LI"].join(",").toLowerCase();
const SKIP_TAGS = new Set(["STYLE", "SCRIPT", "META", "TITLE", "HEAD", "TEMPLATE"]);

// Puts a code around the words, keeping spaces outside ("**word** " not "**word **").
function wrap(s: string, open: string, close = open) {
  const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return m && m[2] ? `${m[1]}${open}${m[2]}${close}${m[3]}` : s;
}

function inlineCodes(node: Node, inLink = false): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").replace(/\s+/g, " ");
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName;
  if (SKIP_TAGS.has(tag)) return "";
  if (tag === "BR") return "\n";

  const isLink = tag === "A" && SAFE_HREF.test(el.getAttribute("href") ?? "");
  let inner = [...el.childNodes].map((c) => inlineCodes(c, inLink || isLink)).join("");
  const { fontWeight, fontStyle, textDecoration, textDecorationLine } = el.style;
  // Google Docs wraps pasted text in <b style="font-weight:normal">.
  const bold =
    ((tag === "B" || tag === "STRONG") && !["normal", "400"].includes(fontWeight)) ||
    fontWeight === "bold" ||
    Number(fontWeight) >= 600;
  const italic = ((tag === "I" || tag === "EM") && fontStyle !== "normal") || fontStyle === "italic";
  // Links are underlined anyway.
  const underline =
    !inLink && !isLink && (tag === "U" || `${textDecoration} ${textDecorationLine}`.includes("underline"));

  if (underline) inner = wrap(inner, "__");
  if (italic) inner = wrap(inner, "*");
  if (bold) inner = wrap(inner, "**");
  if (isLink) inner = wrap(inner, "[", `](${el.getAttribute("href")})`);
  return inner;
}

const tidy = (s: string) =>
  s
    .replace(/ *\n */g, "\n")
    .replace(/ {2,}/g, " ")
    .trim();

export function fromHtml(root: Node): string {
  const out: { bullet: boolean; text: string }[] = [];
  let buffer = "";
  const flush = () => {
    const text = tidy(buffer);
    if (text) out.push({ bullet: false, text });
    buffer = "";
  };

  function listItem(li: Element) {
    let text = "";
    const nested: Element[] = [];
    for (const c of li.childNodes) {
      if (c instanceof Element && (c.tagName === "UL" || c.tagName === "OL")) nested.push(c);
      else text += inlineCodes(c);
    }
    text = tidy(text.replace(/\n+/g, " "));
    if (text) out.push({ bullet: true, text });
    for (const list of nested) for (const item of list.children) listItem(item);
  }

  function walk(node: Node) {
    for (const child of node.childNodes) {
      if (child instanceof Element) {
        const tag = child.tagName;
        if (SKIP_TAGS.has(tag)) continue;
        if (tag === "UL" || tag === "OL") {
          flush();
          for (const item of child.children) listItem(item);
          continue;
        }
        if (tag === "LI") {
          flush();
          listItem(child);
          continue;
        }
        // Blocks, and wrappers around blocks (like Google Docs' <b>), start a new paragraph.
        if (BLOCK_TAGS.includes(tag) || child.querySelector(BLOCK_SELECTOR)) {
          flush();
          walk(child);
          flush();
          continue;
        }
      }
      buffer += inlineCodes(child);
    }
  }

  walk(root);
  flush();
  return out
    .map((b, i) => {
      const line = b.bullet ? `- ${b.text}` : b.text;
      if (i === 0) return line;
      return (b.bullet && out[i - 1].bullet ? "\n" : "\n\n") + line;
    })
    .join("");
}
