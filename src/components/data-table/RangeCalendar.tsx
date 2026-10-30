"use client";

import { format, isBefore, parseISO } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { formatDate } from "@/lib/dates";

// One calendar for a date range (owner, Oct 22): click the start date, then
// the end date (click the same day twice for a single day), then Apply
// (owner, Oct 23). Nothing changes until Apply; closing keeps the old dates.
export function RangeCalendar({
  from,
  to,
  onPick,
}: {
  from: string; // yyyy-MM-dd or ""
  to: string;
  onPick: (from: string, to: string) => void;
}) {
  // The picked range, not yet applied. `end` is "" while waiting for it.
  const [draft, setDraft] = useState({ start: from, end: to });
  const ymd = (d: Date) => format(d, "yyyy-MM-dd");
  const ready = !!draft.start && !!draft.end;
  return (
    // As wide as the calendar: the hint wraps instead of widening the pop-up
    // (w-0 min-w-full on the footer), and Apply sits full width below it.
    <div className="inline-flex flex-col">
      <Calendar
        mode="range"
        selected={draft.start ? { from: parseISO(draft.start), to: draft.end ? parseISO(draft.end) : undefined } : undefined}
        defaultMonth={from ? parseISO(from) : undefined}
        onSelect={(_, day) => {
          if (!draft.start || draft.end) {
            setDraft({ start: ymd(day), end: "" });
            return;
          }
          const start = parseISO(draft.start);
          const [a, b] = isBefore(day, start) ? [day, start] : [start, day];
          setDraft({ start: ymd(a), end: ymd(b) });
        }}
      />
      <div className="flex w-0 min-w-full flex-col gap-2 px-3 pb-3">
        <p className="text-xs text-muted-foreground">
          {!draft.start
            ? "Click the start date, then the end date."
            : !draft.end
              ? `From ${formatDate(draft.start)}: now click the end date.`
              : `${formatDate(draft.start)} – ${formatDate(draft.end)}`}
        </p>
        <Button size="sm" className="w-full" disabled={!ready} onClick={() => onPick(draft.start, draft.end)}>
          Apply
        </Button>
      </div>
    </div>
  );
}
