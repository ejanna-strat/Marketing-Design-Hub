"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CATEGORY_COLORS } from "./palette";

export type MonthSeries = { key: string; label: string; color?: string };

// Grouped bars per month (2–3 series), colours in the fixed categorical
// order, with a legend and a hover pop-up. `stacked`: one bar per month split
// by team or type (owner, Oct 23). A table with the same numbers sits on the
// page, so screen readers skip the chart.
export function MonthBars({
  data,
  series,
  stacked = false,
}: {
  data: Record<string, string | number>[];
  series: MonthSeries[];
  stacked?: boolean;
}) {
  return (
    // Scrolls sideways on phones so twelve months never get squeezed
    // (owner, Oct 24).
    <div className="overflow-x-auto" aria-hidden>
      <div className="h-72 min-w-[32rem]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
            barGap={2}
            barCategoryGap="22%"
          >
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="short"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              labelFormatter={(_, payload) =>
                String(payload?.[0]?.payload?.label ?? "")
              }
              contentStyle={{
                borderRadius: 8,
                borderColor: "var(--border)",
                backgroundColor: "var(--popover)",
                color: "var(--popover-foreground)",
                fontSize: 13,
              }}
              labelStyle={{
                fontWeight: 600,
                color: "var(--popover-foreground)",
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12 }}
              itemSorter={null}
            />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color ?? CATEGORY_COLORS[i]}
                stackId={stacked ? "all" : undefined}
                radius={
                  stacked
                    ? i === series.length - 1
                      ? [3, 3, 0, 0]
                      : 0
                    : [3, 3, 0, 0]
                }
                maxBarSize={stacked ? 36 : 22}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
