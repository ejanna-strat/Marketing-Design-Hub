"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { StarRating } from "@/components/feedback/Stars";
import { UnsavedChangesGuard } from "@/components/form/UnsavedChangesGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FEEDBACK_COPY as C } from "@/lib/feedback";
import { submitFeedback } from "../actions";

export function FeedbackForm({ code }: { code: string }) {
  const [process, setProcess] = useState(0);
  const [output, setOutput] = useState(0);
  const [comments, setComments] = useState("");
  const [tried, setTried] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const started = (process > 0 || output > 0 || comments.trim() !== "") && !pending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!process || !output) {
      toast.error("Please rate both the process and the output.");
      return;
    }
    startTransition(async () => {
      const result = await submitFeedback({ code, process, output, comments });
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="space-y-6">
      <UnsavedChangesGuard
        active={started}
        onSave={() => formRef.current?.requestSubmit()}
        title="Submit your feedback?"
        description="You've started rating this request but haven't submitted it yet."
        saveLabel="Submit feedback"
        leaveLabel="Leave without submitting"
        stayLabel="Keep editing"
      />
      <Card>
        <CardHeader>
          <CardTitle>
            {C.process.heading} <span className="text-destructive">*</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{C.process.question}</p>
          <StarRating name={C.process.heading} value={process} onChange={setProcess} levels={C.process.levels} invalid={tried && !process} />
          {tried && !process && <p className="text-sm text-destructive">Please choose a rating.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            {C.output.heading} <span className="text-destructive">*</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{C.output.question}</p>
          <StarRating name={C.output.heading} value={output} onChange={setOutput} levels={C.output.levels} invalid={tried && !output} />
          {tried && !output && <p className="text-sm text-destructive">Please choose a rating.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <Label htmlFor="comments" className="text-base">
              {C.comments.heading}
            </Label>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{C.comments.question}</p>
          <Textarea id="comments" rows={4} value={comments} onChange={(e) => setComments(e.target.value)} maxLength={5000} />
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Submitting…" : "Submit Feedback"}
        </Button>
      </div>
    </form>
  );
}
