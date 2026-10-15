"use client";

import { format, parseISO } from "date-fns";
import { CalendarIcon, PencilIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { type RequestPatch, updateRequest } from "@/app/admin/actions";
import { OutputLink } from "@/components/LinkifiedText";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/dates";
import { STATUSES, statusBadgeClass } from "@/lib/statuses";
import { cn } from "@/lib/utils";

// Inline editors for pipeline fields, used in the Pipeline table and on the
// admin Request Details page. Each change is saved straight away.

export type DesignerOption = { id: string; name: string; active: boolean };

function useSave(requestId: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function save(patch: RequestPatch, success: string, onError?: () => void) {
    startTransition(async () => {
      const result = await updateRequest(requestId, patch);
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.error);
        onError?.();
      }
    });
  }
  return { save, pending };
}

export function StatusSelect({ requestId, value, label }: { requestId: string; value: string; label?: string }) {
  const { save, pending } = useSave(requestId);
  const [current, setCurrent] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setCurrent(value);
  }

  return (
    <Select
      value={current}
      disabled={pending}
      onValueChange={(next) => {
        const previous = current;
        setCurrent(next);
        save({ status: next as RequestPatch["status"] }, "Status updated", () => setCurrent(previous));
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={label ?? "Status"}
        className={cn("h-7 max-w-56 rounded-full border-0 text-xs font-medium", statusBadgeClass(current))}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        {STATUSES.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const UNASSIGNED = "__none__";

export function DesignerSelect({
  requestId,
  value,
  designers,
}: {
  requestId: string;
  value: string | null;
  designers: DesignerOption[];
}) {
  const { save, pending } = useSave(requestId);
  const [current, setCurrent] = useState(value ?? UNASSIGNED);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setCurrent(value ?? UNASSIGNED);
  }
  // Former designers stay listed only on requests they already have.
  const options = designers.filter((d) => d.active || d.id === value);

  return (
    <Select
      value={current}
      disabled={pending}
      onValueChange={(next) => {
        const previous = current;
        setCurrent(next);
        save(
          { assigned_designer_id: next === UNASSIGNED ? null : next },
          next === UNASSIGNED ? "Designer removed" : "Designer assigned",
          () => setCurrent(previous),
        );
      }}
    >
      <SelectTrigger size="sm" aria-label="Assigned Designer" className="h-7 min-w-32 bg-background text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectItem value={UNASSIGNED}>
          <span className="text-muted-foreground">— Unassigned</span>
        </SelectItem>
        {options.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function LinkEditor({ requestId, value }: { requestId: string; value: string | null }) {
  const { save, pending } = useSave(requestId);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  return (
    <div className="flex items-center gap-1">
      <OutputLink value={value} />
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setDraft(value ?? "");
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label={value ? "Edit Link to Output" : "Add Link to Output"}>
            <PencilIcon />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              save({ link_to_output: draft }, draft.trim() ? "Link to Output saved" : "Link to Output removed");
              setOpen(false);
            }}
          >
            <label className="text-sm font-medium" htmlFor={`link-${requestId}`}>
              Link to Output
            </label>
            <Input
              id={`link-${requestId}`}
              placeholder="https://…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                Save
              </Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function DateNeededEditor({ requestId, value }: { requestId: string; value: string }) {
  const { save, pending } = useSave(requestId);
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending} aria-label="Change Date Needed" className="font-normal">
          <CalendarIcon className="text-muted-foreground" />
          {formatDate(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parseISO(value)}
          defaultMonth={parseISO(value)}
          onSelect={(d) => {
            if (!d) return;
            setOpen(false);
            const next = format(d, "yyyy-MM-dd");
            if (next !== value) save({ date_needed: next }, "Date Needed updated");
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
