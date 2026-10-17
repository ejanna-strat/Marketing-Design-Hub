"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { updateSpecifications } from "@/app/admin/actions";
import { DynamicQuestion } from "@/components/form/DynamicQuestion";
import { UnsavedChangesGuard } from "@/components/form/UnsavedChangesGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type AnswersFormValues, type AnswerValue, buildAnswersSchema, type FormQuestion } from "@/lib/requests/schema";

export function SpecsForm({
  requestId,
  code,
  title,
  typeName,
  questions,
  initialAnswers,
}: {
  requestId: string;
  code: string;
  title: string;
  typeName: string;
  questions: FormQuestion[];
  initialAnswers: Record<string, AnswerValue>;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<AnswersFormValues>({
    resolver: zodResolver(buildAnswersSchema(questions)),
    defaultValues: { answers: initialAnswers },
  });
  const answerErrors = errors.answers as Record<string, { message?: string }> | undefined;

  const onSubmit = handleSubmit(
    async (values) => {
      const result = await updateSpecifications(requestId, values.answers);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      reset(values);
      toast.success("Specifications updated");
      router.push(`/admin/requests/${code}`);
      router.refresh();
    },
    () => {
      toast.error("Please check the highlighted questions.");
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>("[aria-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" }),
      );
    },
  );

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="mx-auto max-w-3xl space-y-6">
      <UnsavedChangesGuard active={isDirty && !isSubmitting} onSave={() => formRef.current?.requestSubmit()} />
      <div className="space-y-1">
        <p className="font-mono text-sm text-muted-foreground">{code}</p>
        <h1 className="text-2xl font-bold">Edit specifications</h1>
        <p className="text-muted-foreground">{title}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Request Specifications</CardTitle>
          <CardDescription>
            {typeName}. The type of design request can&apos;t be changed; changes are saved to the activity log.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {questions.map((q) => (
            <Controller
              key={q.id}
              control={control}
              name={`answers.${q.id}`}
              render={({ field }) => (
                <DynamicQuestion question={q} value={field.value} onChange={field.onChange} error={answerErrors?.[q.id]?.message} />
              )}
            />
          ))}
        </CardContent>
      </Card>
      <div className="flex items-center justify-end gap-3">
        <Button asChild variant="outline" size="lg">
          <Link href={`/admin/requests/${code}`}>Cancel</Link>
        </Button>
        <Button type="submit" size="lg" disabled={isSubmitting || !isDirty} title={!isDirty ? "No changes to save yet" : undefined}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
