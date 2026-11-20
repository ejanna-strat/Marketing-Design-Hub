// Announcements on the main page (owner, Nov 20). Up to 3 rotate in the top
// banner; the side panel lists every live one. Dates are Manila calendar
// days (YYYY-MM-DD): live from startsOn through endsOn (no end = until removed).

// Highest first (owner, Nov 20). The colour follows the priority.
export const PRIORITIES = ["urgent", "important", "new", "fyi"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const MAX_IN_BANNER = 3;

export type Announcement = {
  id: string;
  headline: string;
  message: string;
  linkLabel: string | null;
  linkUrl: string | null;
  // The longer message the button opens instead of a link (FAQ formatting codes).
  details: string | null;
  priority: Priority;
  inBanner: boolean;
  startsOn: string;
  endsOn: string | null;
  updatedAt: string;
};

export const ANNOUNCEMENT_COLUMNS =
  "id, headline, message, link_label, link_url, details, priority, in_banner, starts_on, ends_on, updated_at" as const;

type Row = {
  id: string;
  headline: string;
  message: string;
  link_label: string | null;
  link_url: string | null;
  details: string | null;
  priority: string;
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
    priority: (PRIORITIES as readonly string[]).includes(r.priority) ? (r.priority as Priority) : "new",
    inBanner: r.in_banner,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    updatedAt: r.updated_at,
  };
}

// The add/edit form's values (Settings and the main page's panel).
export type AnnouncementForm = {
  id: string;
  headline: string;
  message: string;
  linkLabel: string;
  buttonAction: "link" | "details";
  linkUrl: string;
  details: string;
  priority: Priority;
  inBanner: boolean;
  startsOn: string;
  endsOn: string | null;
};

// A blank form (new announcements start today, in the banner if there's room).
export function newAnnouncementForm(today: string, inBanner = true): AnnouncementForm {
  return {
    id: "",
    headline: "",
    message: "",
    linkLabel: "",
    buttonAction: "link",
    linkUrl: "",
    details: "",
    priority: "new",
    inBanner,
    startsOn: today,
    endsOn: null,
  };
}

export function announcementForm(a: Announcement): AnnouncementForm {
  return {
    id: a.id,
    headline: a.headline,
    message: a.message,
    linkLabel: a.linkLabel ?? "",
    buttonAction: a.details ? "details" : "link",
    linkUrl: (a.linkUrl ?? "").replace(/^mailto:/, ""),
    details: a.details ?? "",
    priority: a.priority,
    inBanner: a.inBanner,
    startsOn: a.startsOn,
    endsOn: a.endsOn,
  };
}

export type Phase = "live" | "scheduled" | "ended";

export function phaseOf(a: Pick<Announcement, "startsOn" | "endsOn">, today: string): Phase {
  if (a.endsOn && a.endsOn < today) return "ended";
  if (a.startsOn > today) return "scheduled";
  return "live";
}

// Priority levels (owner, Nov 20), so everyone tags the same way. Each has a
// mid-tone colour that stands out from the page, and a small label shown
// before the headline so the meaning doesn't rely on colour alone.
export const PRIORITY_STYLES: Record<
  Priority,
  { label: string; description: string; strip: string; swatch: string; tag: string }
> = {
  urgent: {
    label: "Urgent",
    description: "Everyone needs to know or act now, or their request is affected today. The banner can't be closed.",
    strip: "bg-[#f7c6d0] text-gray-900 dark:bg-[#4f1f2c] dark:text-gray-100",
    swatch: "bg-[#f7c6d0] ring-[#d9788d] dark:bg-[#4f1f2c]",
    tag: "bg-[#b4233f] text-white",
  },
  important: {
    label: "Important",
    description: "Changes how people work or file requests soon, usually with a date.",
    strip: "bg-[#fbdc8e] text-gray-900 dark:bg-[#4a3610] dark:text-amber-50",
    swatch: "bg-[#fbdc8e] ring-[#d9a62a] dark:bg-[#4a3610]",
    tag: "bg-[#8a5a00] text-white",
  },
  new: {
    label: "New",
    description: "A new feature, request type or improvement that's ready to use.",
    strip: "bg-[#b5d8f5] text-gray-900 dark:bg-[#123d63] dark:text-gray-100",
    swatch: "bg-[#b5d8f5] ring-[#5a9fd6] dark:bg-[#123d63]",
    tag: "bg-[#1f6fbf] text-white",
  },
  fyi: {
    label: "FYI",
    description: "Good to know: no action needed, no deadline.",
    strip: "bg-[#d3d9e1] text-gray-900 dark:bg-[#2f3a48] dark:text-gray-100",
    swatch: "bg-[#d3d9e1] ring-[#8a96a6] dark:bg-[#2f3a48]",
    tag: "bg-[#4a5568] text-white",
  },
};

// Higher priority first, then the newest start date.
export function byPriority(a: Announcement, b: Announcement) {
  return PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) || b.startsOn.localeCompare(a.startsOn);
}

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
