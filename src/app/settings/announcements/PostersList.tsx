"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { setPoster } from "./actions";

export type Poster = { id: string; name: string; email: string; isSuperAdmin: boolean; canPost: boolean };

// Super Admins only: tick the team members who can also post (owner, Nov 20).
// Super Admins can always post. Only people who have signed in at least once
// are listed.
export function PostersList({ people, myId }: { people: Poster[]; myId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  function toggle(p: Poster, on: boolean) {
    setBusy(p.id);
    startTransition(async () => {
      const result = await setPoster(p.id, on);
      setBusy(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(on ? `${p.name} can now post announcements` : `${p.name} can no longer post announcements`);
      router.refresh();
    });
  }

  return (
    <section className="space-y-3 rounded-xl border bg-background p-5">
      <div className="space-y-1">
        <h2 className="font-semibold">Who can post announcements</h2>
        <p className="text-sm text-muted-foreground">
          Super Admins always can. Tick anyone else on the team who should. Only Super Admins see this list.
        </p>
      </div>
      <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {people.map((p) => (
          <li key={p.id} className="flex items-start gap-2.5">
            <Checkbox
              id={`poster-${p.id}`}
              checked={p.isSuperAdmin || p.canPost}
              disabled={p.isSuperAdmin || (pending && busy === p.id)}
              onCheckedChange={(on) => toggle(p, on === true)}
              className="mt-0.5"
            />
            <Label htmlFor={`poster-${p.id}`} className="block font-normal leading-snug">
              <span className="font-medium">
                {p.name}
                {p.id === myId && <span className="text-muted-foreground"> (you)</span>}
              </span>
              <span className="block text-xs text-muted-foreground">
                {p.isSuperAdmin ? "Super Admin · always can post" : p.email}
              </span>
            </Label>
          </li>
        ))}
      </ul>
    </section>
  );
}
