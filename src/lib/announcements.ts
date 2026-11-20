// Announcements on the main page (owner, Nov 20). Up to 3 rotate in the top
// banner; the side panel lists every live one. Dates are Manila calendar
// days (YYYY-MM-DD): live from startsOn through endsOn (no end = until removed).

export const TONES = ["blue", "pink", "amber", "neutral"] as const;
export type Tone = (typeof TONES)[number];

export const MAX_IN_BANNER = 3;

export type Announcement = {
  id: string;
  headline: string;
  message: string;
  linkLabel: string | null;
  linkUrl: string | null;
  // The longer message the button opens instead of a link (FAQ formatting codes).
  details: string | null;
  tone: Tone;
  inBanner: boolean;
  startsOn: string;
  endsOn: string | null;
  updatedAt: string;
};

export const ANNOUNCEMENT_COLUMNS =
  "id, headline, message, link_label, link_url, details, tone, in_banner, starts_on, ends_on, updated_at" as const;

type Row = {
  id: string;
  headline: string;
  message: string;
  link_label: string | null;
  link_url: string | null;
  details: string | null;
  tone: string;
  in_banner: boolean;
  starts_on: string;
  ends_on: string | null;
  updated_at: string;
};

export function toAnnouncement(r: Row): Announcement {
  return {
    id: r.id,
    headline: r.headline,
    message: r.message,
    linkLabel: r.link_label,
    linkUrl: r.link_url,
    details: r.details,
    tone: (TONES as readonly string[]).includes(r.tone) ? (r.tone as Tone) : "blue",
    inBanner: r.in_banner,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    updatedAt: r.updated_at,
  };
}

export type Phase = "live" | "scheduled" | "ended";

export function phaseOf(a: Pick<Announcement, "startsOn" | "endsOn">, today: string): Phase {
  if (a.endsOn && a.endsOn < today) return "ended";
  if (a.startsOn > today) return "scheduled";
  return "live";
}

// Colour choices: the strip's background and its label in Settings. Mid
// tones so the banner stands out from the page (owner, Nov 20: the first
// blue was too faint; green became pink). Dark text reads on all of them.
export const TONE_STYLES: Record<Tone, { label: string; strip: string; swatch: string }> = {
  blue: {
    label: "Blue",
    strip: "bg-[#b5d8f5] text-gray-900 dark:bg-[#123d63] dark:text-gray-100",
    swatch: "bg-[#b5d8f5] ring-[#5a9fd6] dark:bg-[#123d63]",
  },
  pink: {
    label: "Pink",
    strip: "bg-[#f7c6d0] text-gray-900 dark:bg-[#4f1f2c] dark:text-gray-100",
    swatch: "bg-[#f7c6d0] ring-[#d9788d] dark:bg-[#4f1f2c]",
  },
  amber: {
    label: "Amber",
    strip: "bg-[#fbdc8e] text-gray-900 dark:bg-[#4a3610] dark:text-amber-50",
    swatch: "bg-[#fbdc8e] ring-[#d9a62a] dark:bg-[#4a3610]",
  },
  neutral: {
    label: "Grey",
    strip: "bg-[#d3d9e1] text-gray-900 dark:bg-[#2f3a48] dark:text-gray-100",
    swatch: "bg-[#d3d9e1] ring-[#8a96a6] dark:bg-[#2f3a48]",
  },
};

// Remembers, for this browser tab only, that the banner was closed. Signing
// out (or closing the tab) brings it back; so does a new or edited banner.
export const BANNER_CLOSED_KEY = "mdh-announcements-closed";
// The announcements this browser has seen in the side panel (the dot on the icon).
export const ANNOUNCEMENTS_SEEN_KEY = "mdh-announcements-seen";

export function forgetClosedBanner() {
  try {
    sessionStorage.removeItem(BANNER_CLOSED_KEY);
  } catch {}
}
