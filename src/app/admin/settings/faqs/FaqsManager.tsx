"use client";

import { ArrowDownIcon, ArrowUpIcon, EyeOffIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FaqAnswer } from "@/components/FaqAnswer";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { deleteFaq, reorderFaqs, saveFaq } from "./actions";

export type Faq = {
  id: string;
  question: string;
  answer: string;
  visible: boolean;
};

const EMPTY: Faq = { id: "", question: "", answer: "", visible: true };

export function FaqsManager({ faqs }: { faqs: Faq[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Faq | null>(null);
  const [deleting, setDeleting] = useState<Faq | null>(null);
  const [pending, startTransition] = useTransition();

  function move(index: number, by: -1 | 1) {
    const ids = faqs.map((f) => f.id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    startTransition(async () => {
      const result = await reorderFaqs(ids);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function remove(faq: Faq) {
    startTransition(async () => {
      const result = await deleteFaq(faq.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("The question was deleted");
      setDeleting(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing(EMPTY)}>
          <PlusIcon />
          Add question
        </Button>
      </div>

      <ol className={cn("divide-y rounded-xl border bg-background", pending && "opacity-60")}>
        {faqs.length === 0 ? (
          <li className="p-8 text-center text-muted-foreground">
            No questions yet. The home page hides the FAQ section until you add one.
          </li>
        ) : (
          faqs.map((f, i) => (
            <li key={f.id} className="flex items-start gap-3 p-4">
              <span className="mt-0.5 w-5 shrink-0 text-right text-sm text-muted-foreground">{i + 1}.</span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className={cn("font-medium", !f.visible && "text-muted-foreground")}>
                  {f.question}
                  {!f.visible && (
                    <Badge variant="secondary" className="ml-2 align-middle">
                      <EyeOffIcon />
                      Hidden
                    </Badge>
                  )}
                </p>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {f.answer.replace(/\*\*|\[|\]\([^)]*\)/g, "")}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move "${f.question}" up`}
                  disabled={i === 0 || pending}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move "${f.question}" down`}
                  disabled={i === faqs.length - 1 || pending}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDownIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit "${f.question}"`}
                  onClick={() => setEditing(f)}
                >
                  <PencilIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete "${f.question}"`}
                  onClick={() => setDeleting(f)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2Icon />
                </Button>
              </div>
            </li>
          ))
        )}
      </ol>

      {editing && (
        <FaqDialog
          key={editing.id || "new"}
          faq={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this question?</DialogTitle>
            <DialogDescription>
              &ldquo;{deleting?.question}&rdquo; will be removed from the home page and can&apos;t be brought back. To
              take it off the home page for now, edit it and untick &ldquo;Show on the home page&rdquo; instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={pending} onClick={() => deleting && remove(deleting)}>
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FaqDialog({ faq, onClose, onSaved }: { faq: Faq; onClose: () => void; onSaved: () => void }) {
  const isNew = !faq.id;
  const [form, setForm] = useState(faq);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await saveFaq({
        id: form.id || undefined,
        question: form.question,
        answer: form.answer,
        visible: form.visible,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(isNew ? "The question was added" : "The question was updated");
      onSaved();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{isNew ? "Add question" : "Edit question"}</DialogTitle>
            <DialogDescription>
              {isNew
                ? "New questions go at the bottom of the list. Use the arrows to move them."
                : "Changes show on the home page right away."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="faq-question">Question</Label>
            <Textarea
              id="faq-question"
              rows={2}
              maxLength={300}
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
              required
              autoFocus={isNew}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="faq-answer">Answer</Label>
            <Textarea
              id="faq-answer"
              rows={8}
              maxLength={5000}
              value={form.answer}
              onChange={(e) => setForm({ ...form, answer: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              Leave a blank line between paragraphs. Start a line with &ldquo;- &rdquo; for a bullet. Wrap words in
              **double stars** for bold. Links: [link text](https://…) or
              [name@stratpoint.com](mailto:name@stratpoint.com).
            </p>
          </div>

          {form.answer.trim() && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Preview</p>
              <div className="max-h-60 overflow-y-auto rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
                <FaqAnswer text={form.answer} />
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5">
            <Checkbox
              id="faq-visible"
              checked={form.visible}
              onCheckedChange={(on) => setForm({ ...form, visible: on === true })}
              className="mt-0.5"
            />
            <Label htmlFor="faq-visible" className="block font-normal leading-snug">
              <span className="font-medium">Show on the home page</span>
              <span className="block text-xs text-muted-foreground">
                Untick to hide it for now without deleting it.
              </span>
            </Label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isNew ? "Add question" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
