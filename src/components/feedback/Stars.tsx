"use client";

import { StarIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// 1–5 star picker. Only a click sets the rating (solid yellow); hovering
// shows a faint outline preview and "Click to rate …", so a hover never
// looks like a saved rating (owner, Oct 21).
export function StarRating({
  name,
  value,
  onChange,
  levels,
  invalid,
}: {
  name: string;
  value: number;
  onChange: (value: number) => void;
  levels: readonly string[];
  invalid?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const previewing = hover > 0 && hover !== value;
  return (
    <div className="space-y-2">
      <div
        role="radiogroup"
        aria-label={name}
        aria-invalid={invalid || undefined}
        className="flex gap-1"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}: ${levels[n - 1]}`}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            className="rounded-md p-0.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <StarIcon
              className={cn(
                "size-8 transition-colors",
                n <= value
                  ? "fill-amber-400 text-amber-400"
                  : previewing && n <= hover
                    ? "fill-amber-100 text-amber-400"
                    : "fill-transparent text-muted-foreground/40",
                // Stars that a click would turn off fade a little.
                previewing && n <= value && n > hover && "opacity-50",
              )}
            />
          </button>
        ))}
      </div>
      <p className="min-h-5 text-sm">
        {previewing ? (
          <span className="text-muted-foreground">
            Click to rate {hover} – {levels[hover - 1]}
          </span>
        ) : value ? (
          <span className="font-medium">
            You rated {value} of 5 – {levels[value - 1]}
          </span>
        ) : (
          <span className="text-muted-foreground">Click a star to rate (1 to 5).</span>
        )}
      </p>
    </div>
  );
}

// Read-only stars, e.g. "★★★★☆ 4.5".
export function StarsDisplay({ value, size = "sm" }: { value: number; size?: "sm" | "md" }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${value} out of 5 stars`}>
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <StarIcon
            key={n}
            className={cn(
              size === "md" ? "size-5" : "size-3.5",
              n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground/40",
            )}
          />
        ))}
      </span>
      <span className="font-medium">{Number.isInteger(value) ? value : value.toFixed(1)}</span>
    </span>
  );
}
