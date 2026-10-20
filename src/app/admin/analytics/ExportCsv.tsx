"use client";

import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Downloads the monthly table as a CSV file (opens in Excel / Google Sheets).
export function ExportCsv({ filename, rows }: { filename: string; rows: (string | number)[][] }) {
  function download() {
    const cell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const csv = rows.map((r) => r.map(cell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Button variant="outline" size="sm" onClick={download}>
      <DownloadIcon />
      Export CSV
    </Button>
  );
}
