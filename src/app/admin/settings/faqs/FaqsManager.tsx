"use client";

import { EyeOffIcon, GripVerticalIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
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
import { faqPlainText } from "@/lib/faq-format";
import { cn } from "@/lib/utils";
import { deleteFaq, reorderFaqs, saveFaq } from "./actions";
import { FaqAnswerEditor } from "./FaqAnswerEditor";

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

  // While dragging (and until the saved order comes back), the list follows
  // this order instead of the server's.
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const byId = new Map(faqs.map((f) => [f.id, f]));
  const items = order ? order.map((id) => byId.get(id)).filter((f): f is Faq => !!f) : faqs;

  function save(ids: string[]) {
    if (ids.join() === faqs.map((f) => f.id).join()) {
      setOrder(null);
      return;
    }
    setOrder(ids);
    startTransition(async () => {
      const result = await reorderFaqs(ids);
      if (!result.ok) toast.error(result.error);
      // Swap to the saved order in one go, without a flash of the old one.
      startTransition(() => {
        router.refresh();
        setOrder(null);
      });
    });
  }

  function moveTo(ids: string[], id: string, index: number) {
    const rest = ids.filter((x) => x !== id);
    rest.splice(Math.max(0, Math.min(index, rest.length)), 0, id);
    return rest;
  }

  // Drag by the grip: mouse, pen or touch (pointer events, no library). The
  // page listens while dragging, since rows move under the pointer.
  function startDrag(e: React.PointerEvent, id: string) {
    if (pending || e.button !== 0) return;
    e.preventDefault();
    let ids = items.map((f) => f.id);
    setDragging(id);
    setOrder(ids);

    function onMove(ev: PointerEvent) {
      if (!listRef.current) return;
      const rows = [...listRef.current.querySelectorAll<HTMLElement>("li[data-id]")].filter(
        (row) => row.dataset.id !== id,
      );
      // New place = how many of the other rows are above the pointer.
      const index = rows.filter((row) => {
        const r = row.getBoundingClientRect();
        return ev.clientY > r.top + r.height / 2;
      }).length;
      const next = moveTo(ids, id, index);
      if (next.join() !== ids.join()) {
        ids = next;
        setOrder(next);
      }
    }
    function onEnd() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      setDragging(null);
      save(ids);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  }

  // Keyboard: focus the grip and press the up or down arrow.
  function nudge(e: React.KeyboardEvent, index: number) {
    const by = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!by || pending) return;
    e.preventDefault();
    const ids = items.map((f) => f.id);
    if (index + by < 0 || index + by >= ids.length) return;
    save(moveTo(ids, ids[index], index + by));
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Drag <GripVerticalIcon className="inline size-4 align-text-bottom" /> to change the order.
        </p>
        <Button onClick={() => setEditing(EMPTY)}>
          <PlusIcon />
          Add question
        </Button>
      </div>

      <ol
        ref={listRef}
        className={cn("divide-y rounded-xl border bg-background", pending && !dragging && "opacity-60")}
      >
        {items.length === 0 ? (
          <li className="p-8 text-center text-muted-foreground">
            No questions yet. The home page hides the FAQ section until you add one.
          </li>
        ) : (
          items.map((f, i) => (
            <li
              key={f.id}
              data-id={f.id}
              className={cn(
                "flex items-start gap-2 p-4 pl-2 transition-colors",
                dragging === f.id && "relative z-10 rounded-lg bg-brand-soft/60 shadow-md",
              )}
            >
              <button
                type="button"
                aria-label={`Reorder "${f.question}" (drag, or use the up and down arrow keys)`}
                title="Drag to reorder"
                onPointerDown={(e) => startDrag(e, f.id)}
                onKeyDown={(e) => nudge(e, i)}
                className={cn(
                  "-my-1 shrink-0 touch-none rounded-md p-1 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                  dragging === f.id ? "cursor-grabbing" : "cursor-grab",
                )}
              >
                <GripVerticalIcon className="size-5" />
              </button>
              <span className="mt-0.5 w-5 shrink-0 text-right text-sm text-muted-foreground">{i + 1}.</span>
              <div className="min-w-0 flex-1 space-y-1 select-none">
                <p className={cn("font-medium", !f.visible && "text-muted-foreground")}>
                  {f.question}
                  {!f.visible && (
                    <Badge variant="secondary" className="ml-2 align-middle">
                      <EyeOffIcon />
                      Hidden
                    </Badge>
                  )}
                </p>
                <p className="line-clamp-2 text-sm text-muted-foreground">{faqPlainText(f.answer)}</p>
              </div>
              <div className="flex shrink-0 gap-1">
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
    if (!form.answer.trim()) {
      setError("Please enter the answer.");
      return;
    }
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
                ? "New questions go at the bottom of the list. Drag them to change the order."
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
            <Label id="faq-answer-label">Answer</Label>
            <FaqAnswerEditor
              labelId="faq-answer-label"
              initial={faq.answer}
              onChange={(answer) => setForm((f) => ({ ...f, answer }))}
            />
            <p className="text-xs text-muted-foreground">
              Highlight words and use the buttons above. Pasted text keeps bold, italic, underline, links and bullets
              only, so every answer looks the same on the home page.
            </p>
          </div>

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
