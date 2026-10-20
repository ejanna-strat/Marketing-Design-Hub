"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CATEGORY_COLORS } from "./palette";

export type MonthSeries = { key: string; label: string };

// Grouped bars per month (2–3 series), colours in the fixed categorical
// order, with a legend and a hover pop-up. A table with the same numbers sits
// on the page, so screen readers skip the chart.
export function MonthBars({ data, series }: { data: Record<string, string | number>[]; series: MonthSeries[] }) {
  return (
    <div className="h-72" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="#eef0f3" />
          <XAxis dataKey="short" tickLine={false} axisLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: "#f3f6fb" }}
            labelFormatter={(_, payload) => String(payload?.[0]?.payload?.label ?? "")}
            contentStyle={{ borderRadius: 8, borderColor: "#e5e7eb", fontSize: 13 }}
            labelStyle={{ fontWeight: 600, color: "#111827" }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} itemSorter={null} />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={CATEGORY_COLORS[i]}
              radius={[3, 3, 0, 0]}
              maxBarSize={22}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
