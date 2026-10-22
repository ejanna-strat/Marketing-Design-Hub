"use client";

import { XIcon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { hideApprover } from "@/app/account/actions";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type Approver = { name: string; email: string };

// Approver Name with a dropdown of the requester's last 5 approvers (owner,
// Oct 22): it opens on click or while typing, narrows as they type, and
// picking one fills both Approver Name and Approver Email. Arrow keys and
// Enter work too. The × on a suggestion removes it (it comes back if that
// approver is used again).
export function ApproverNameInput({
  id,
  value,
  onChange,
  onPick,
  recent: initialRecent,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onPick: (approver: Approver) => void;
  recent: Approver[];
  invalid?: boolean;
}) {
  const listId = useId();
  const [recent, setRecent] = useState(initialRecent);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const q = value.trim().toLowerCase();
  const matches = recent.filter((a) => !q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
  const show = open && matches.length > 0 && !recent.some((a) => a.name === value && matches.length === 1);

  function remove(a: Approver) {
    setRecent((list) => list.filter((x) => x.email !== a.email));
    setActive(-1);
    hideApprover(a.email).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        setRecent(initialRecent);
      }
    });
  }

  function pick(a: Approver) {
    onPick(a);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % matches.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i <= 0 ? matches.length - 1 : i - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(matches[active]!);
          } else if (e.key === "Delete" && active >= 0) {
            e.preventDefault();
            remove(matches[active]!);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {show && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Recent approvers"
          className="absolute top-full right-0 left-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border bg-popover p-1 text-sm shadow-md"
        >
          <li className="px-2 py-1 text-xs text-muted-foreground" role="presentation">
            Recent approvers
          </li>
          {matches.map((a, i) => (
            <li
              key={a.email}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown so the pick happens before the field loses focus
              onMouseDown={(e) => {
                e.preventDefault();
                pick(a);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md py-1 pr-1 pl-2",
                i === active && "bg-brand-soft",
              )}
            >
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{a.name}</span>
                <span className="text-muted-foreground"> · {a.email}</span>
              </span>
              <button
                type="button"
                tabIndex={-1}
                aria-label={`Remove ${a.name} from suggestions`}
                title="Remove from suggestions"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  remove(a);
                }}
                className="shrink-0 cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <XIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
