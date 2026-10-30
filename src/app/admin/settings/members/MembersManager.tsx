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
  copyLeadEmails: boolean;
  copyRequesterEmails: boolean;
  signedIn: boolean;
};

const TAG_STYLES: Record<string, string> = {
  super_admin: "bg-slate-900 text-white dark:bg-white dark:text-slate-900",
  admin: "bg-brand text-white",
  lead_designer: "bg-brand-soft text-brand",
  designer: "bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300",
};

const EMPTY: Member = { email: "", fullName: "", roles: [], designerName: "",
  copyLeadEmails: false,
  copyRequesterEmails: false,
  signedIn: false,
};

export function MembersManager({
  members,
  currentEmail,
  canGrantAdmin,
  canGrantSuper,
}: {
  members: Member[];
  currentEmail: string;
  // Super Admins and Admins give or remove the Admin tag.
  canGrantAdmin: boolean;
  // Only Super Admins give, remove or change the Super Admin tag.
  canGrantSuper: boolean;
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
              <TableHead className="text-xs font-semibold">Copied on emails</TableHead>
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
                const protectedAdmin =
                  (m.roles.includes("admin") && !canGrantAdmin) || (m.roles.includes("super_admin") && !canGrantSuper);
                const who = m.roles.includes("super_admin") ? "a Super Admin" : "an Admin";
                const onlyWho = m.roles.includes("super_admin") ? "Only Super Admins" : "Only Admins";
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
                      {m.copyLeadEmails || m.copyRequesterEmails ? (
                        <span className="inline-flex flex-col gap-0.5 text-sm">
                          {m.copyLeadEmails && (
                            <span className="inline-flex items-center gap-1">
                              <MailIcon className="size-3.5 text-brand" />
                              Lead&apos;s email
                            </span>
                          )}
                          {m.copyRequesterEmails && (
                            <span className="inline-flex items-center gap-1">
                              <MailIcon className="size-3.5 text-brand" />
                              Requester&apos;s email
                            </span>
                          )}
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
                          title={protectedAdmin ? `${onlyWho} can change ${who}` : undefined}
                          onClick={() => setEditing({ member: m, isNew: false })}
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${m.fullName}`}
                          disabled={isMe || protectedAdmin}
                          title={isMe ? "You can't remove yourself" : protectedAdmin ? `${onlyWho} can remove ${who}` : undefined}
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
          canGrantSuper={canGrantSuper}
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
  canGrantSuper,
  onClose,
  onSaved,
}: {
  member: Member;
  isNew: boolean;
  isMe: boolean;
  canGrantAdmin: boolean;
  canGrantSuper: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setFormState] = useState(member);
  const [error, setError] = useState<string>();
  // Any edit clears the last error, so an old message doesn't stick around.
  const setForm: typeof setFormState = (next) => {
    setError(undefined);
    setFormState(next);
  };
  const [pending, startTransition] = useTransition();
  const isDesigner = form.roles.includes("designer") || form.roles.includes("lead_designer");
  // Lead Designers already get the Lead Designer emails.
  const isLead = form.roles.includes("lead_designer");
  // Email copies need a tag first (owner, Oct 30).
  const hasTag = form.roles.length > 0;
  // Checked once they leave the field, then live as they fix it (owner, Oct 30).
  const [emailLeft, setEmailLeft] = useState(false);
  const badEmail = isNew && form.email.trim() !== "" && !/^[^@\s]+@stratpoint\.com$/i.test(form.email.trim());
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
        copyLeadEmails: hasTag && !isLead && form.copyLeadEmails,
        copyRequesterEmails: hasTag && form.copyRequesterEmails,
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
              onBlur={() => setEmailLeft(true)}
              aria-invalid={emailLeft && badEmail}
              aria-describedby="member-email-hint"
              disabled={!isNew}
              required
              autoFocus={isNew}
            />
            {isNew &&
              (emailLeft && badEmail ? (
                <p id="member-email-hint" className="text-xs text-destructive">
                  Please enter a @stratpoint.com email address.
                </p>
              ) : (
                <p id="member-email-hint" className="text-xs text-muted-foreground">
                  Use their main email address, not an alias.
                </p>
              ))}
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
                (r.value === "admin" && (!canGrantAdmin || (isMe && member.roles.includes("admin")))) ||
                (r.value === "super_admin" && !canGrantSuper);
              const note =
                r.value === "admin" && !canGrantAdmin
                  ? " Only Super Admins and Admins can give this tag."
                  : r.value === "admin" && isMe && member.roles.includes("admin")
                    ? " You can't remove your own Admin tag."
                    : r.value === "super_admin" && !canGrantSuper
                      ? " Only Super Admins can give this tag."
                      : r.value === "super_admin" && isMe && member.roles.includes("super_admin")
                        ? " You can step down once someone else is a Super Admin."
                        : "";
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
                      {note}
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

          {/* Not tags: kept apart so nobody mistakes them for a role (owner, Oct 30). */}
          <fieldset disabled={!hasTag} className="space-y-3 border-t pt-4">
            <legend className="float-left mb-3 w-full">
              <span className="block text-sm font-medium">Email copies</span>
              <span className="block text-xs font-normal text-muted-foreground">
                {hasTag
                  ? "Optional, and not a tag: these only send them extra emails."
                  : "Choose a tag first. These are only for members with a tag."}
              </span>
            </legend>
            {isLead ? (
              <p className="clear-left text-xs text-muted-foreground">
                Lead Designers already get the Lead&apos;s emails.
              </p>
            ) : (
              <div className={cn("clear-left flex items-start gap-2.5", !hasTag && "opacity-50")}>
                <Checkbox
                  id="member-lead-emails"
                  checked={hasTag && form.copyLeadEmails}
                  disabled={!hasTag}
                  onCheckedChange={(on) => setForm({ ...form, copyLeadEmails: on === true })}
                  className="mt-0.5"
                />
                <Label htmlFor="member-lead-emails" className="block font-normal leading-snug">
                  <span className="font-medium">Copy on Lead&apos;s email</span>
                  <span className="block text-xs text-muted-foreground">
                    New Design Request, the daily New Request Reminder and the 3-day Deadline reminder, for every request.
                  </span>
                </Label>
              </div>
            )}

            <div className={cn("clear-left flex items-start gap-2.5", !hasTag && "opacity-50")}>
              <Checkbox
                id="member-requester-emails"
                checked={hasTag && form.copyRequesterEmails}
                disabled={!hasTag}
                onCheckedChange={(on) => setForm({ ...form, copyRequesterEmails: on === true })}
                className="mt-0.5"
              />
              <Label htmlFor="member-requester-emails" className="block font-normal leading-snug">
                <span className="font-medium">Copy on requester&apos;s email</span>
                <span className="block text-xs text-muted-foreground">
                  Designer accepted and Designer changed, the emails requesters get about who&apos;s working on their
                  request.
                </span>
              </Label>
            </div>
          </fieldset>

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            !hasTag && <p className="text-sm text-muted-foreground">Choose at least one tag to save this member.</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !hasTag || badEmail}>
              {pending ? "Saving…" : isNew ? "Add member" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
