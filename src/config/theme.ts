// Brand settings in one place. The web UI reads the same colour from
// `--brand` in src/app/globals.css — change both together.
export const theme = {
  // Owner, Nov 13: the app is the Marketing Support Hub (sign-in pages,
  // browser tab, email sender); design requests live in its Creative Hub
  // (top bar, home page, the emails' header and footer). Content Requests
  // will be a second hub.
  suiteName: "Marketing Support Hub",
  appName: "Creative Hub",
  company: "Stratpoint Technologies",
  // Owner, Nov 10: Stratpoint's Primary Blue #008ce0 for buttons, icons and
  // highlights (was #3b94e4); the deeper brandInk keeps small blue text
  // (links, titles) easy to read.
  brand: "#008ce0",
  brandInk: "#1f6fbf",
  brandSoft: "#e7f2fc",
  timeZone: "Asia/Manila",
} as const;
