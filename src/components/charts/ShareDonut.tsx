"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Share } from "./palette";

// Donut showing each category's share; the table beside it is the legend.
export function ShareDonut({ data, unit = "requests" }: { data: (Share & { color: string })[]; unit?: string }) {
  const total = data.reduce((n, d) => n + d.value, 0);
  return (
    <div className="relative mx-auto size-44 shrink-0" aria-hidden>
      {/* The total sits under the chart so the hover pop-up covers it, not the other way round. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{total}</span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="62%"
            outerRadius="100%"
            paddingAngle={data.length > 1 ? 2 : 0}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.label} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, name) => [`${v} ${unit} (${Math.round((Number(v) / total) * 100)}%)`, name]}
            contentStyle={{ borderRadius: 8, borderColor: "#e5e7eb", fontSize: 13, whiteSpace: "nowrap" }}
            wrapperStyle={{ zIndex: 10 }}
            allowEscapeViewBox={{ x: true, y: true }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
