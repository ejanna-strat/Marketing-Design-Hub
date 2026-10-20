// A Link to Output must be one web link (owner, Oct 21). The database checks
// the same pattern (0012_output_link_check.sql).
export const OUTPUT_LINK = /^https?:\/\/[^\s/]+\.\S+$/i;

export const OUTPUT_LINK_ERROR = "Please enter a valid link that starts with https:// (e.g. https://docs.google.com/…).";

export function isOutputLink(value: string) {
  if (!OUTPUT_LINK.test(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
