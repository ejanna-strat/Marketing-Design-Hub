// A Link to Output must be one web link (owner, Oct 21). The database checks
// the same pattern (0012_output_link_check.sql).
export const OUTPUT_LINK = /^https?:\/\/[^\s/]+\.\S+$/i;

export const OUTPUT_LINK_ERROR = "Please enter a valid link that starts with https:// (e.g. https://docs.google.com/…).";

// Up to three Links to Output, each with an optional name (owner, Nov 4).
// An unnamed link shows as "Output link" when it's the only one (owner, Nov 4),
// otherwise as "Link 1", "Link 2", "Link 3".
export const LINK_LABEL_MAX = 60;

export type OutputLinkItem = { url: string; label: string; named: boolean };

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
  const slots = linkSlots(r);
  const single = slots.filter((s) => s.url).length === 1;
  return slots.flatMap((s, i) => {
    if (!s.url) return [];
    const name = s.label.trim();
    return [{ url: s.url, label: name || (single ? "Output link" : `Link ${i + 1}`), named: !!name }];
  });
}

// Two links count as the same when they only differ in the site name's
// capitals or a trailing "/" (paths stay exact: Drive and Figma IDs are
// case-sensitive) (owner, Nov 4).
export function linkKey(value: string) {
  const v = value.trim();
  try {
    const u = new URL(v);
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "")}${u.search}${u.hash}`;
  } catch {
    return v;
  }
}

// For each slot, the earlier slot holding the same link, or -1.
export function duplicateOf(urls: string[]) {
  return urls.map((url, i) =>
    url.trim() ? urls.findIndex((other, j) => j < i && other.trim() && linkKey(other) === linkKey(url)) : -1,
  );
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
