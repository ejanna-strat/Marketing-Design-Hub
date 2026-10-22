// Brand settings in one place. The web UI reads the same colour from
// `--brand` in src/app/globals.css — change both together.
export const theme = {
  appName: "Marketing Design Hub",
  company: "Stratpoint Technologies",
  // Owner, Oct 22: #3b94e4 for buttons, icons and highlights; the deeper
  // brandInk keeps small blue text (links, titles) easy to read.
  brand: "#3b94e4",
  brandInk: "#1f6fbf",
  brandSoft: "#e7f2fc",
  timeZone: "Asia/Manila",
} as const;
