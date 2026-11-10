// Brand settings in one place. The web UI reads the same colour from
// `--brand` in src/app/globals.css — change both together.
export const theme = {
  appName: "Marketing Creative Hub",
  company: "Stratpoint Technologies",
  // Owner, Nov 10: Stratpoint's Primary Blue #008ce0 for buttons, icons and
  // highlights (was #3b94e4); the deeper brandInk keeps small blue text
  // (links, titles) easy to read.
  brand: "#008ce0",
  brandInk: "#1f6fbf",
  brandSoft: "#e7f2fc",
  timeZone: "Asia/Manila",
} as const;
