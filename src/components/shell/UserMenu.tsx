"use client";

import { ChevronDownIcon, LogOutIcon, UserPenIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateMyName } from "@/app/account/actions";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UserMenu({ name, email, roleLabel }: { name: string; email: string; roleLabel: string }) {
  const [editing, setEditing] = useState(false);
  const initials = (name || email)
    .split(/[\s.@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className="flex size-7 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
            {initials}
          </span>
          <span className="hidden max-w-40 truncate sm:inline">{name || email}</span>
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <div className="truncate font-medium text-foreground">{name}</div>
            <div className="truncate text-xs text-muted-foreground">{email}</div>
            <div className="mt-1 text-xs text-brand">{roleLabel}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <UserPenIcon />
            Change my name
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => signOut()}>
            <LogOutIcon />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {editing && <NameDialog current={name} onClose={() => setEditing(false)} />}
    </>
  );
}

function NameDialog({ current, onClose }: { current: string; onClose: () => void }) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const changed = value.trim().replace(/\s+/g, " ") !== current;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await updateMyName(value);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Your name was updated");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Change my name</DialogTitle>
            <DialogDescription>
              Shown on your new requests and to the Design team. Requests you already filed keep the name they were
              filed with.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="my-name">Full name</Label>
            <Input id="my-name" value={value} onChange={(e) => setValue(e.target.value)} autoFocus required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !changed}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
