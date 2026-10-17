"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { theme } from "@/config/theme";

export type BarDatum = { label: string; value: number };

const shorten = (s: string, max = 28) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

// Horizontal bar chart in one hue (magnitude): thin bars with rounded data
// ends, values written at the bar end, recessive axes, hover tooltip with the
// full name. Long category names are shortened on the axis.
export function BarList({
  data,
  unit = "requests",
  emptyText = "No data yet.",
}: {
  data: BarDatum[];
  unit?: string;
  emptyText?: string;
}) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }
  const height = Math.max(110, data.length * 32 + 16);
  return (
    <>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 40, bottom: 8, left: 0 }} barCategoryGap={8}>
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="label"
              width={190}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#6b7280", fontSize: 12 }}
              tickFormatter={(v: string) => shorten(v)}
            />
            <Tooltip
              cursor={{ fill: theme.brandSoft }}
              formatter={(v) => [`${v} ${unit}`, ""]}
              separator=""
              contentStyle={{ borderRadius: 8, borderColor: "#e5e7eb", fontSize: 13 }}
              labelStyle={{ fontWeight: 600, color: "#111827" }}
            />
            <Bar dataKey="value" fill={theme.brand} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
              <LabelList dataKey="value" position="right" style={{ fill: "#374151", fontSize: 12, fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Screen readers get the numbers as a list. */}
      <ul className="sr-only">
        {data.map((d) => (
          <li key={d.label}>
            {d.label}: {d.value} {unit}
          </li>
        ))}
      </ul>
    </>
  );
}
