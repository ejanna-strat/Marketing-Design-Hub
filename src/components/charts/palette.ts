// Categorical palette in a fixed order (first slice always gets the first
// colour). Anything past the last slot is folded into "Other" by foldShares.
export const CATEGORY_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const OTHER_COLOR = "#9ca3af";

export type Share = { label: string; value: number };

// Largest first; beyond `max - 1` categories, the rest become "Other".
export function foldShares(data: Share[], max = CATEGORY_COLORS.length): (Share & { color: string })[] {
  const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const kept = sorted.length > max ? sorted.slice(0, max - 1) : sorted;
  const rest = sorted.slice(kept.length).reduce((n, d) => n + d.value, 0);
  return [
    ...kept.map((d, i) => ({ ...d, color: CATEGORY_COLORS[i] })),
    ...(rest ? [{ label: "Other", value: rest, color: OTHER_COLOR }] : []),
  ];
}
