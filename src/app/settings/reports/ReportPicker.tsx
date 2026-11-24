"use client";

import { DownloadIcon } from "lucide-react";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Year + "Whole year" or a month, then a plain download link.
export function ReportPicker({ years, archived }: { years: number[]; archived: number[] }) {
  const [year, setYear] = useState(String(years[0]));
  const [month, setMonth] = useState("all");
  const href = `/settings/reports/report?year=${year}${month === "all" ? "" : `&month=${month}`}`;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="report-year">Year</Label>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger id="report-year" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
                {archived.includes(y) ? " (archived)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="report-month">Period</Label>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger id="report-month" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Whole year, by month</SelectItem>
            {MONTHS.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <a
        href={href}
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90"
      >
        <DownloadIcon className="size-4" />
        Download report
      </a>
    </div>
  );
}
