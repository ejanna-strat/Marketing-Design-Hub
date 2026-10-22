"use client";

import { MailIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MEMBER_ROLES, type MemberRole, roleLabel } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { removeMember, saveMember } from "./actions";

export type Member = {
  email: string;
  fullName: string;
  roles: MemberRole[];
  designerName: string;
  getsTeamEmails: boolean;
  signedIn: boolean;
};

const TAG_STYLES: Record<string, string> = {
  admin: "bg-brand text-white",
  lead_designer: "bg-brand-soft text-brand",
  designer: "bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300",
};

const EMPTY: Member = { email: "", fullName: "", roles: [], designerName: "", getsTeamEmails: false, signedIn: false };

export function MembersManager({
  members,
  currentEmail,
  canGrantAdmin,
}: {
  members: Member[];
  currentEmail: string;
  // Only Admins can give or remove the Admin tag.
  canGrantAdmin: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ member: Member; isNew: boolean } | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(member: Member) {
    startTransition(async () => {
      const result = await removeMember(member.email);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${member.fullName} was removed from the team`);
      setRemoving(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ member: EMPTY, isNew: true })}>
          <PlusIcon />
          Add member
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-background">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-xs font-semibold">Member</TableHead>
              <TableHead className="text-xs font-semibold">Tags</TableHead>
              <TableHead className="text-xs font-semibold">Name in Designer list</TableHead>
              <TableHead className="text-xs font-semibold">Copied on updates</TableHead>
              <TableHead className="text-xs font-semibold">Signed in</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No members yet.
                </TableCell>
              </TableRow>
            ) : (
              members.map((m) => {
                const isMe = m.email === currentEmail.toLowerCase();
                const protectedAdmin = m.roles.includes("admin") && !canGrantAdmin;
                return (
                  <TableRow key={m.email}>
                    <TableCell>
                      <div className="font-medium">
                        {m.fullName}
                        {isMe && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{m.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {m.roles.map((r) => (
                          <span key={r} className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TAG_STYLES[r])}>
                            {roleLabel(r)}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{m.designerName || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      {m.getsTeamEmails ? (
                        <span className="inline-flex items-center gap-1 text-sm">
                          <MailIcon className="size-3.5 text-brand" />
                          Yes
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.signedIn ? "Yes" : <span className="text-muted-foreground">Not yet</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${m.fullName}`}
                          disabled={protectedAdmin}
                          title={protectedAdmin ? "Only Admins can change an Admin" : undefined}
                          onClick={() => setEditing({ member: m, isNew: false })}
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${m.fullName}`}
                          disabled={isMe || protectedAdmin}
                          title={isMe ? "You can't remove yourself" : protectedAdmin ? "Only Admins can remove an Admin" : undefined}
                          onClick={() => setRemoving(m)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 rounded-xl border bg-background p-4 text-sm sm:grid-cols-3">
        {MEMBER_ROLES.map((r) => (
          <div key={r.value} className="space-y-1">
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TAG_STYLES[r.value])}>{r.label}</span>
            <p className="text-muted-foreground">{r.description}</p>
          </div>
        ))}
      </div>

      {editing && (
        <MemberDialog
          key={editing.member.email || "new"}
          member={editing.member}
          isNew={editing.isNew}
          isMe={editing.member.email === currentEmail.toLowerCase()}
          canGrantAdmin={canGrantAdmin}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      <Dialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removing?.fullName}?</DialogTitle>
            <DialogDescription>
              They will lose access to the pipeline and become a Requester. They can still file and track their own
              requests. Requests already assigned to them keep their name.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={pending} onClick={() => removing && remove(removing)}>
              {pending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MemberDialog({
  member,
  isNew,
  isMe,
  canGrantAdmin,
  onClose,
  onSaved,
}: {
  member: Member;
  isNew: boolean;
  isMe: boolean;
  canGrantAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(member);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const isDesigner = form.roles.includes("designer") || form.roles.includes("lead_designer");
  const firstName = form.fullName.trim().split(/\s+/)[0] ?? "";

  function toggle(role: MemberRole, on: boolean) {
    setForm((f) => ({ ...f, roles: on ? [...f.roles, role] : f.roles.filter((r) => r !== role) }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await saveMember({
        email: form.email,
        fullName: form.fullName,
        roles: form.roles,
        designerName: isDesigner ? form.designerName : "",
        getsTeamEmails: form.getsTeamEmails,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(isNew ? `${form.fullName} was added to the team` : `${form.fullName} was updated`);
      onSaved();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{isNew ? "Add member" : `Edit ${member.fullName}`}</DialogTitle>
            <DialogDescription>
              {isNew
                ? "They get access as soon as they sign in with this email (or refresh, if they're already signed in)."
                : "Changes apply the next time they open or refresh a page."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="member-email">Stratpoint email</Label>
            <Input
              id="member-email"
              type="email"
              placeholder="name@stratpoint.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={!isNew}
              required
              autoFocus={isNew}
            />
            {isNew && <p className="text-xs text-muted-foreground">Use their main email address, not an alias.</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-name">Full name</Label>
            <Input
              id="member-name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-medium">Tags</legend>
            {MEMBER_ROLES.map((r) => {
              const locked =
                r.value === "admin" && (!canGrantAdmin || (isMe && member.roles.includes("admin")));
              return (
                <div key={r.value} className="flex items-start gap-2.5">
                  <Checkbox
                    id={`tag-${r.value}`}
                    checked={form.roles.includes(r.value)}
                    disabled={locked}
                    onCheckedChange={(on) => toggle(r.value, on === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor={`tag-${r.value}`} className="block font-normal leading-snug">
                    <span className="font-medium">{r.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {r.description}
                      {r.value === "admin" && !canGrantAdmin && " Only Admins can give this tag."}
                      {r.value === "admin" && canGrantAdmin && isMe && member.roles.includes("admin") &&
                        " You can't remove your own Admin tag."}
                    </span>
                  </Label>
                </div>
              );
            })}
          </fieldset>

          {isDesigner && (
            <div className="space-y-2">
              <Label htmlFor="member-designer-name">Name in the Designer list</Label>
              <Input
                id="member-designer-name"
                placeholder={firstName || "e.g. Sofia"}
                value={form.designerName}
                onChange={(e) => setForm({ ...form, designerName: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Shown in the Assigned Designer dropdown. Leave empty to use their first name.
              </p>
            </div>
          )}

          <div className="flex items-start gap-2.5">
            <Checkbox
              id="member-team-emails"
              checked={form.getsTeamEmails}
              onCheckedChange={(on) => setForm({ ...form, getsTeamEmails: on === true })}
              className="mt-0.5"
            />
            <Label htmlFor="member-team-emails" className="block font-normal leading-snug">
              <span className="font-medium">Copy me on request updates</span>
              <span className="block text-xs text-muted-foreground">
                Also gets the emails Lead Designers get: New Design Request, the daily New Request Reminder, designer assigned and designer accepted.
              </span>
            </Label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isNew ? "Add member" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
