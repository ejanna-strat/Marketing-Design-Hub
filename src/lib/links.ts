// A Link to Output must be one web link (owner, Oct 21). The database checks
// the same pattern (0012_output_link_check.sql).
export const OUTPUT_LINK = /^https?:\/\/[^\s/]+\.\S+$/i;

export const OUTPUT_LINK_ERROR = "Please enter a valid link that starts with https:// (e.g. https://docs.google.com/…).";

// Up to three Links to Output, each with an optional name (owner, Nov 4).
// Unnamed links show as "Link 1", "Link 2", "Link 3".
export const LINK_LABEL_MAX = 60;

export type OutputLinkItem = { url: string; label: string };

export type OutputLinkFields = {
  link_to_output: string | null;
  link_to_output_2?: string | null;
  link_to_output_3?: string | null;
  link_label_1?: string | null;
  link_label_2?: string | null;
  link_label_3?: string | null;
};

// The three slots as stored (empty ones included), for editing.
export function linkSlots(r: OutputLinkFields) {
  return [
    { url: r.link_to_output ?? "", label: r.link_label_1 ?? "" },
    { url: r.link_to_output_2 ?? "", label: r.link_label_2 ?? "" },
    { url: r.link_to_output_3 ?? "", label: r.link_label_3 ?? "" },
  ];
}

// The filled-in links, in order, each with its name or "Link N".
export function outputLinks(r: OutputLinkFields): OutputLinkItem[] {
  return linkSlots(r).flatMap((s, i) => (s.url ? [{ url: s.url, label: s.label.trim() || `Link ${i + 1}` }] : []));
}

export function isOutputLink(value: string) {
  if (!OUTPUT_LINK.test(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
