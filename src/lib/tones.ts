// Tinted tile colours shared by the Dashboard's top tiles and the Analytics
// Request flow (owner, Oct 23–24), with dark-mode versions.
export const TONES = {
  slate: "bg-slate-100 text-slate-900 dark:bg-slate-500/15 dark:text-slate-100",
  blue: "bg-sky-100/70 text-sky-950 dark:bg-sky-500/15 dark:text-sky-100",
  green: "bg-emerald-100/70 text-emerald-950 dark:bg-emerald-500/15 dark:text-emerald-100",
  amber: "bg-amber-100/70 text-amber-950 dark:bg-amber-500/15 dark:text-amber-100",
  grey: "bg-muted text-foreground",
} as const;

export type Tone = keyof typeof TONES;
