"use client";

import { format, isBefore, parseISO } from "date-fns";
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { formatDate } from "@/lib/dates";

// One calendar for a date range (owner, Oct 22): click the start date, then
// the end date (click the same day twice for a single day). The range is
// applied once both ends are picked.
export function RangeCalendar({
  from,
  to,
  onPick,
}: {
  from: string; // yyyy-MM-dd or ""
  to: string;
  onPick: (from: string, to: string) => void;
}) {
  const [start, setStart] = useState<Date | null>(null);
  const selected = start
    ? { from: start, to: undefined }
    : from
      ? { from: parseISO(from), to: to ? parseISO(to) : undefined }
      : undefined;
  return (
    <div className="space-y-2">
      <Calendar
        mode="range"
        selected={selected}
        defaultMonth={from ? parseISO(from) : undefined}
        onSelect={(_, day) => {
          if (!start) {
            setStart(day);
            return;
          }
          const [a, b] = isBefore(day, start) ? [day, start] : [start, day];
          setStart(null);
          onPick(format(a, "yyyy-MM-dd"), format(b, "yyyy-MM-dd"));
        }}
      />
      <p className="px-3 pb-1 text-xs text-muted-foreground">
        {start ? `From ${formatDate(format(start, "yyyy-MM-dd"))}: now click the end date.` : "Click the start date, then the end date."}
      </p>
    </div>
  );
}
