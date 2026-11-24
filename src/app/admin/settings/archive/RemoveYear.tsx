"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { archiveYear } from "./actions";

// Super Admins: remove a year's finished requests after downloading them.
// Confirmed by typing the number of requests (owner, Nov 24).
export function RemoveYear({ year, count }: { year: number; count: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(undefined);
    startTransition(async () => {
      const result = await archiveYear(year, Number(typed));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`${year} archived: ${result.removed} requests removed`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="text-destructive hover:text-destructive">
        <Trash2Icon />
        Remove from app
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {year}&apos;s requests?</DialogTitle>
            <DialogDescription>
              This removes {count} finished requests filed in {year}, with their answers, history, feedback and email
              log. {year}&apos;s report is saved first, so Analytics and Reports still show the year. Requesters
              won&apos;t see these requests in Track My Request anymore. <strong>This can&apos;t be undone.</strong> You
              need to have downloaded them in the last 24 hours.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`remove-${year}`}>
              Type <strong>{count}</strong> to confirm
            </Label>
            <Input
              id={`remove-${year}`}
              inputMode="numeric"
              value={typed}
              onChange={(e) => setTyped(e.target.value.replace(/\D/g, ""))}
              autoComplete="off"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Keep requests
            </Button>
            <Button variant="destructive" disabled={pending || typed !== String(count)} onClick={confirm}>
              {pending ? "Archiving…" : "Remove requests"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
